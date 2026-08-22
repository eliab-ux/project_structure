import { Migration } from '@mikro-orm/migrations';

/**
 * EST — `stock_locations` (§2 do 03A) + a dimensão de LOCALIZAÇÃO no `stock_movements`. Pré-requisito
 * do ROT: consignação é carga que sai do depósito e passa a viver "na mão do representante", e sem
 * saldo por local não há como representar isso.
 *
 * Tabela de TENANT com RLS (coberta pelo `verify:isolation`). `stock_locations` tem ciclo de vida
 * (rename/deactivate) → grant COM update, SEM delete.
 *
 * O `location_id` em `stock_movements` entra em três tempos porque a tabela **já tem linhas** em
 * produção (o padrão do CLAUDE.md, regra 9, para coluna obrigatória em tabela populada): (1) toda
 * empresa ganha um depósito default; (2) a coluna entra nullable e é backfillada para o depósito da
 * empresa de cada movimento; (3) vira NOT NULL + FK. A nulidade é transitória, dentro da mesma
 * migration — nenhuma linha fica sem local.
 *
 * O `stock_movements_type_check` é reescrito para admitir os tipos de transferência (implementados)
 * e os reservados do ROT (`trip_*`, `exchange_*`) — o enum nasce completo para não migrar de novo
 * quando o ROT chegar. Criá-los pelo registro manual é recusado na aplicação (REGISTERABLE_...).
 */
export class Migration20260822180000 extends Migration {
  async up(): Promise<void> {
    // ── 1. stock_locations ─────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "stock_locations" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "company_id" uuid not null,
        "kind" varchar(16) not null,
        "name" varchar(120) not null,
        "active" boolean not null default true,
        constraint "stock_locations_pkey" primary key ("id"),
        constraint "stock_locations_kind_check" check ("kind" in ('warehouse','rep_load','pdv')),
        constraint "stock_locations_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "stock_locations_company_id_foreign" foreign key ("company_id") references "companies" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index if not exists "stock_locations_account_id_index" on "stock_locations" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "stock_locations_company_id_index" on "stock_locations" ("company_id");`,
    );

    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;
    this.addSql(`alter table "stock_locations" enable row level security;`);
    this.addSql(`drop policy if exists "stock_locations_tenant_isolation" on "stock_locations";`);
    this.addSql(`
      create policy "stock_locations_tenant_isolation" on "stock_locations"
        for all
        using ("account_id" = ${tenantScope})
        with check ("account_id" = ${tenantScope});
    `);
    // Grant COM update (rename/deactivate), SEM delete.
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert, update on table public.stock_locations to veertex_app;
        end if;
      end
      $$;
    `);

    // ── 2. Depósito default para toda empresa existente ────────────────────────────────────────
    this.addSql(`
      insert into "stock_locations"
        ("id", "account_id", "created_at", "updated_at", "deleted_at", "company_id", "kind", "name", "active")
      select gen_random_uuid(), c."account_id", now(), now(), null, c."id", 'warehouse', 'Depósito principal', true
      from "companies" c
      where not exists (
        select 1 from "stock_locations" l
        where l."company_id" = c."id" and l."kind" = 'warehouse'
      );
    `);

    // ── 3. location_id no stock_movements: nullable → backfill → NOT NULL + FK ──────────────────
    this.addSql(`alter table "stock_movements" add column if not exists "location_id" uuid null;`);
    this.addSql(`
      update "stock_movements" m
      set "location_id" = (
        select l."id" from "stock_locations" l
        where l."company_id" = m."company_id" and l."kind" = 'warehouse'
        order by l."created_at" asc
        limit 1
      )
      where m."location_id" is null;
    `);
    this.addSql(`alter table "stock_movements" alter column "location_id" set not null;`);
    this.addSql(`
      alter table "stock_movements"
        add constraint "stock_movements_location_id_foreign"
        foreign key ("location_id") references "stock_locations" ("id")
        on update cascade on delete restrict;
    `);
    this.addSql(
      `create index if not exists "stock_movements_location_id_index" on "stock_movements" ("location_id");`,
    );

    // ── 4. Enum de tipos completo (transferência + reservados do ROT) ──────────────────────────
    this.addSql(
      `alter table "stock_movements" drop constraint if exists "stock_movements_type_check";`,
    );
    this.addSql(`
      alter table "stock_movements"
        add constraint "stock_movements_type_check" check ("type" in
          ('purchase_in','sale_out','inventory_adjust','customer_return','supplier_return','loss',
           'transfer_out','transfer_in','trip_load','trip_return','exchange_in','exchange_out'));
    `);
  }

  async down(): Promise<void> {
    this.addSql(
      `alter table "stock_movements" drop constraint if exists "stock_movements_type_check";`,
    );
    this.addSql(`
      alter table "stock_movements"
        add constraint "stock_movements_type_check" check ("type" in
          ('purchase_in','sale_out','inventory_adjust','customer_return','supplier_return','loss'));
    `);
    this.addSql(
      `alter table "stock_movements" drop constraint if exists "stock_movements_location_id_foreign";`,
    );
    this.addSql(`drop index if exists "stock_movements_location_id_index";`);
    this.addSql(`alter table "stock_movements" drop column if exists "location_id";`);
    this.addSql(`drop table if exists "stock_locations" cascade;`);
  }
}
