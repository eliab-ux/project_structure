import { Migration } from '@mikro-orm/migrations';

/**
 * ROT fatia 3 (§04) — `trips` (viagem: rota × representante, caixa, km) + `orders.trip_id` + o ciclo
 * consignado no check de status do pedido (`consignado_aberto`, `em_acerto`, `fechado`). Tabela de
 * TENANT com RLS (coberta pelo `verify:isolation`). Grant COM update (status/caixa/km), SEM delete.
 */
export class Migration20260823130000 extends Migration {
  async up(): Promise<void> {
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    this.addSql(`
      create table if not exists "trips" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "company_id" uuid not null,
        "route_id" uuid not null,
        "sales_rep_id" uuid not null,
        "helper_user_id" uuid null,
        "status" varchar(20) not null default 'planejada',
        "departure_at" timestamptz null,
        "return_at" timestamptz null,
        "initial_cash" numeric(14,2) not null default 0,
        "return_cash" numeric(14,2) null,
        "initial_km" numeric(12,1) null,
        "final_km" numeric(12,1) null,
        "load_location_id" uuid null,
        constraint "trips_pkey" primary key ("id"),
        constraint "trips_status_check" check ("status" in
          ('planejada','em_andamento','em_fechamento','fechada','cancelada')),
        constraint "trips_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "trips_company_id_foreign" foreign key ("company_id") references "companies" ("id") on update cascade on delete restrict,
        constraint "trips_route_id_foreign" foreign key ("route_id") references "routes" ("id") on update cascade on delete restrict,
        constraint "trips_sales_rep_foreign" foreign key ("sales_rep_id") references "users" ("id") on update cascade on delete restrict,
        constraint "trips_helper_foreign" foreign key ("helper_user_id") references "users" ("id") on update cascade on delete set null,
        constraint "trips_load_location_foreign" foreign key ("load_location_id") references "stock_locations" ("id") on update cascade on delete set null
      );
    `);
    this.addSql(`create index if not exists "trips_account_id_index" on "trips" ("account_id");`);
    this.addSql(
      `create index if not exists "trips_route_rep_index" on "trips" ("route_id", "sales_rep_id", "status");`,
    );

    this.addSql(`alter table "trips" enable row level security;`);
    this.addSql(`drop policy if exists "trips_tenant_isolation" on "trips";`);
    this.addSql(`
      create policy "trips_tenant_isolation" on "trips"
        for all
        using ("account_id" = ${tenantScope})
        with check ("account_id" = ${tenantScope});
    `);
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert, update on table public.trips to veertex_app;
        end if;
      end
      $$;
    `);

    // ── orders: trip_id + ciclo consignado no check ─────────────────────────────────────────────
    this.addSql(`alter table "orders" add column if not exists "trip_id" uuid null;`);
    this.addSql(`
      alter table "orders"
        add constraint "orders_trip_id_foreign" foreign key ("trip_id")
        references "trips" ("id") on update cascade on delete set null;
    `);
    this.addSql(`create index if not exists "orders_trip_id_index" on "orders" ("trip_id");`);

    this.addSql(`alter table "orders" drop constraint if exists "orders_status_check";`);
    this.addSql(`
      alter table "orders"
        add constraint "orders_status_check" check ("status" in
          ('rascunho','orcamento','confirmado','faturado','concluido','cancelado',
           'consignado_aberto','em_acerto','fechado'));
    `);
  }

  async down(): Promise<void> {
    this.addSql(`alter table "orders" drop constraint if exists "orders_status_check";`);
    this.addSql(`
      alter table "orders"
        add constraint "orders_status_check" check ("status" in
          ('rascunho','orcamento','confirmado','faturado','concluido','cancelado'));
    `);
    this.addSql(`alter table "orders" drop constraint if exists "orders_trip_id_foreign";`);
    this.addSql(`drop index if exists "orders_trip_id_index";`);
    this.addSql(`alter table "orders" drop column if exists "trip_id";`);
    this.addSql(`drop table if exists "trips" cascade;`);
  }
}
