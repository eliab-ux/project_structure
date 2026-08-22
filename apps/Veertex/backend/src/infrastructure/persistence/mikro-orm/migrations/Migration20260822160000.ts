import { Migration } from '@mikro-orm/migrations';

/**
 * EST — `stock_reservations` (§3.9). Reservas reduzem o DISPONÍVEL, não o físico. Tabela de TENANT
 * com RLS (coberta pelo `verify:isolation`).
 *
 * Ao contrário de `stock_movements` (append-only), a reserva tem ciclo de vida (active → released),
 * então o grant inclui UPDATE (liberar) — mas SEM DELETE. Expiração é preguiçosa: o índice em
 * `(company_id, product_id, status, expires_at)` sustenta a soma das reservas ativas e não vencidas.
 */
export class Migration20260822160000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table if not exists "stock_reservations" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "company_id" uuid not null,
        "product_id" uuid not null,
        "order_id" uuid null,
        "quantity" numeric(14,3) not null,
        "status" varchar(12) not null default 'active',
        "release_reason" varchar(12) null,
        "expires_at" timestamptz not null,
        constraint "stock_reservations_pkey" primary key ("id"),
        constraint "stock_reservations_status_check" check ("status" in ('active','released')),
        constraint "stock_reservations_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "stock_reservations_company_id_foreign" foreign key ("company_id") references "companies" ("id") on update cascade on delete restrict,
        constraint "stock_reservations_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade on delete restrict,
        constraint "stock_reservations_order_id_foreign" foreign key ("order_id") references "orders" ("id") on update cascade on delete set null
      );
    `);
    this.addSql(
      `create index if not exists "stock_reservations_account_id_index" on "stock_reservations" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "stock_reservations_order_id_index" on "stock_reservations" ("order_id");`,
    );
    this.addSql(`
      create index if not exists "stock_reservations_available_index"
        on "stock_reservations" ("company_id", "product_id", "status", "expires_at");
    `);

    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;
    this.addSql(`alter table "stock_reservations" enable row level security;`);
    this.addSql(
      `drop policy if exists "stock_reservations_tenant_isolation" on "stock_reservations";`,
    );
    this.addSql(`
      create policy "stock_reservations_tenant_isolation" on "stock_reservations"
        for all
        using ("account_id" = ${tenantScope})
        with check ("account_id" = ${tenantScope});
    `);

    // Grant COM update (liberar), SEM delete.
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert, update on table public.stock_reservations to veertex_app;
        end if;
      end
      $$;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "stock_reservations" cascade;`);
  }
}
