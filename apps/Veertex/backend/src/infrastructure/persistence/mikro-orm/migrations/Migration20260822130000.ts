import { Migration } from '@mikro-orm/migrations';

/**
 * VND — pedidos. Três tabelas, todas de TENANT: `orders`, `order_items`, `order_counters`.
 *
 * Cada uma carrega `account_id NOT NULL` e tem **policy de RLS própria** — RLS não segue JOIN, então
 * a filha (`order_items`) precisa da sua, como as filhas de Contato/Produto. O `verify:isolation`
 * descobre as três sozinho (deriva de `account_id`); as policies existem aqui, no mesmo commit.
 *
 * Numeração POR empresa (§2.6): único parcial `(account_id, company_id, number)` em `orders`, e um
 * contador `(account_id, company_id)` em `order_counters`, alocado com lock. Grants ao runtime SEM
 * DELETE (sincronização de itens é soft-delete).
 *
 * Migration ADITIVA: só cria.
 */
export class Migration20260822130000 extends Migration {
  async up(): Promise<void> {
    // ── orders ─────────────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "orders" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "company_id" uuid not null,
        "contact_id" uuid not null,
        "sales_rep_id" uuid null,
        "number" int not null,
        "origin" varchar(20) not null,
        "status" varchar(20) not null default 'rascunho',
        "discount_percent" numeric(5,2) not null default 0,
        "discount_value" numeric(14,2) not null default 0,
        "notes" text null,
        "reference_date" timestamptz not null,
        constraint "orders_pkey" primary key ("id"),
        constraint "orders_status_check" check ("status" in ('rascunho','confirmado','faturado','concluido','cancelado')),
        constraint "orders_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "orders_company_id_foreign" foreign key ("company_id") references "companies" ("id") on update cascade on delete restrict,
        constraint "orders_contact_id_foreign" foreign key ("contact_id") references "contacts" ("id") on update cascade on delete restrict,
        constraint "orders_sales_rep_id_foreign" foreign key ("sales_rep_id") references "users" ("id") on update cascade on delete set null
      );
    `);
    this.addSql(`create index if not exists "orders_account_id_index" on "orders" ("account_id");`);
    this.addSql(`create index if not exists "orders_company_id_index" on "orders" ("company_id");`);
    this.addSql(`create index if not exists "orders_contact_id_index" on "orders" ("contact_id");`);
    this.addSql(
      `create index if not exists "orders_sales_rep_id_index" on "orders" ("sales_rep_id");`,
    );
    this.addSql(`create index if not exists "orders_status_index" on "orders" ("status");`);
    // Numeração POR empresa: único parcial, ignorando soft-deletados.
    this.addSql(`
      create unique index if not exists "orders_account_company_number_unique"
        on "orders" ("account_id", "company_id", "number")
        where "deleted_at" is null;
    `);

    // ── order_items ────────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "order_items" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "order_id" uuid not null,
        "product_id" uuid not null,
        "description" varchar(200) not null,
        "quantity" numeric(14,3) not null,
        "unit_price" numeric(14,2) not null,
        "discount_percent" numeric(5,2) not null default 0,
        "discount_value" numeric(14,2) not null default 0,
        constraint "order_items_pkey" primary key ("id"),
        constraint "order_items_order_id_foreign" foreign key ("order_id") references "orders" ("id") on update cascade on delete cascade,
        constraint "order_items_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "order_items_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index if not exists "order_items_account_id_index" on "order_items" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "order_items_order_id_index" on "order_items" ("order_id");`,
    );
    this.addSql(
      `create index if not exists "order_items_product_id_index" on "order_items" ("product_id");`,
    );

    // ── order_counters ─────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "order_counters" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "company_id" uuid not null,
        "next_number" int not null default 1,
        constraint "order_counters_pkey" primary key ("id"),
        constraint "order_counters_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "order_counters_company_id_foreign" foreign key ("company_id") references "companies" ("id") on update cascade on delete cascade
      );
    `);
    this.addSql(
      `create index if not exists "order_counters_account_id_index" on "order_counters" ("account_id");`,
    );
    this.addSql(`
      create unique index if not exists "order_counters_account_company_unique"
        on "order_counters" ("account_id", "company_id");
    `);

    // ── RLS: uma policy por tabela ───────────────────────────────────────────────────────────────
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;
    for (const table of ['orders', 'order_items', 'order_counters']) {
      this.addSql(`alter table "${table}" enable row level security;`);
      this.addSql(`drop policy if exists "${table}_tenant_isolation" on "${table}";`);
      this.addSql(`
        create policy "${table}_tenant_isolation" on "${table}"
          for all
          using ("account_id" = ${tenantScope})
          with check ("account_id" = ${tenantScope});
      `);
    }

    // ── Grants ao runtime — SEM DELETE ───────────────────────────────────────────────────────────
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert, update on table public.orders to veertex_app;
          grant select, insert, update on table public.order_items to veertex_app;
          grant select, insert, update on table public.order_counters to veertex_app;
        end if;
      end
      $$;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "order_items" cascade;`);
    this.addSql(`drop table if exists "order_counters" cascade;`);
    this.addSql(`drop table if exists "orders" cascade;`);
  }
}
