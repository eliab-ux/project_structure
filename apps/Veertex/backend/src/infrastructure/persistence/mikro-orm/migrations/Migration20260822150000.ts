import { Migration } from '@mikro-orm/migrations';

/**
 * EST — `stock_movements` (append-only) + a preferência `stock_allow_negative`. Migration ADITIVA.
 *
 * Tabela de TENANT com RLS própria (coberta pelo `verify:isolation`). **Grant SEM UPDATE e SEM
 * DELETE** — movimento é append-only (§2.7 do 03): só INSERT e SELECT. É o único caso do sistema que
 * nem precisa de UPDATE, e negá-lo torna a imutabilidade uma garantia do banco, não uma convenção.
 *
 * Não há tabela de saldo: o saldo é derivado por `SUM()` (§3.1). O índice `(company_id, product_id,
 * occurred_at)` é o que sustenta o fold cronológico do saldo sem varredura.
 */
export class Migration20260822150000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "accounts"
        add column if not exists "stock_allow_negative" boolean not null default false;
    `);

    this.addSql(`
      create table if not exists "stock_movements" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "company_id" uuid not null,
        "product_id" uuid not null,
        "type" varchar(30) not null,
        "signed_quantity" numeric(14,3) not null,
        "unit_cost" numeric(14,4) null,
        "related_movement_id" uuid null,
        "used_fallback" boolean not null default false,
        "note" text null,
        "occurred_at" timestamptz not null,
        constraint "stock_movements_pkey" primary key ("id"),
        constraint "stock_movements_type_check" check ("type" in
          ('purchase_in','sale_out','inventory_adjust','customer_return','supplier_return','loss')),
        constraint "stock_movements_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "stock_movements_company_id_foreign" foreign key ("company_id") references "companies" ("id") on update cascade on delete restrict,
        constraint "stock_movements_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade on delete restrict,
        constraint "stock_movements_related_foreign" foreign key ("related_movement_id") references "stock_movements" ("id") on update cascade on delete set null
      );
    `);
    this.addSql(
      `create index if not exists "stock_movements_account_id_index" on "stock_movements" ("account_id");`,
    );
    // O índice do fold do saldo: por (empresa, produto) em ordem cronológica.
    this.addSql(`
      create index if not exists "stock_movements_company_product_occurred_index"
        on "stock_movements" ("company_id", "product_id", "occurred_at");
    `);

    // ── RLS ──────────────────────────────────────────────────────────────────────────────────────
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;
    this.addSql(`alter table "stock_movements" enable row level security;`);
    this.addSql(`drop policy if exists "stock_movements_tenant_isolation" on "stock_movements";`);
    this.addSql(`
      create policy "stock_movements_tenant_isolation" on "stock_movements"
        for all
        using ("account_id" = ${tenantScope})
        with check ("account_id" = ${tenantScope});
    `);

    // Grant SÓ select+insert: movimento é append-only, nunca UPDATE nem DELETE.
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert on table public.stock_movements to veertex_app;
        end if;
      end
      $$;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "stock_movements" cascade;`);
    this.addSql(`alter table "accounts" drop column if exists "stock_allow_negative";`);
  }
}
