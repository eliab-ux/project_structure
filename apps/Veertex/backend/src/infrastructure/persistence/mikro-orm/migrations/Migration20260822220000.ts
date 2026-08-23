import { Migration } from '@mikro-orm/migrations';

/**
 * VND — `price_lists` + `price_list_items` (§3.2 do 02A): tabelas de preço multi-canal com degrau
 * por quantidade. Ambas de TENANT com RLS (cobertas pelo `verify:isolation`). A filha carrega
 * `account_id` e tem policy PRÓPRIA (RLS não segue JOIN). Grant COM update (editar tabela/itens),
 * SEM delete — a substituição de itens é soft-delete, e desativar a tabela não a apaga.
 */
export class Migration20260822220000 extends Migration {
  async up(): Promise<void> {
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    // ── price_lists ─────────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "price_lists" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "name" varchar(120) not null,
        "active" boolean not null default true,
        "contact_id" uuid null,
        "sales_rep_id" uuid null,
        constraint "price_lists_pkey" primary key ("id"),
        constraint "price_lists_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "price_lists_contact_id_foreign" foreign key ("contact_id") references "contacts" ("id") on update cascade on delete set null,
        constraint "price_lists_sales_rep_id_foreign" foreign key ("sales_rep_id") references "users" ("id") on update cascade on delete set null
      );
    `);
    this.addSql(
      `create index if not exists "price_lists_account_id_index" on "price_lists" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "price_lists_contact_id_index" on "price_lists" ("contact_id");`,
    );
    this.addSql(
      `create index if not exists "price_lists_sales_rep_id_index" on "price_lists" ("sales_rep_id");`,
    );

    // ── price_list_items ────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "price_list_items" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "price_list_id" uuid not null,
        "product_id" uuid not null,
        "price" numeric(14,2) not null,
        "min_quantity" int not null default 1,
        constraint "price_list_items_pkey" primary key ("id"),
        constraint "price_list_items_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "price_list_items_list_foreign" foreign key ("price_list_id") references "price_lists" ("id") on update cascade on delete cascade,
        constraint "price_list_items_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index if not exists "price_list_items_account_id_index" on "price_list_items" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "price_list_items_list_product_index" on "price_list_items" ("price_list_id", "product_id");`,
    );

    // ── RLS + grants (as duas tabelas) ──────────────────────────────────────────────────────────
    for (const table of ['price_lists', 'price_list_items']) {
      this.addSql(`alter table "${table}" enable row level security;`);
      this.addSql(`drop policy if exists "${table}_tenant_isolation" on "${table}";`);
      this.addSql(`
        create policy "${table}_tenant_isolation" on "${table}"
          for all
          using ("account_id" = ${tenantScope})
          with check ("account_id" = ${tenantScope});
      `);
      this.addSql(`
        do $$
        begin
          if exists (select 1 from pg_roles where rolname = 'veertex_app') then
            grant select, insert, update on table public.${table} to veertex_app;
          end if;
        end
        $$;
      `);
    }
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "price_list_items" cascade;`);
    this.addSql(`drop table if exists "price_lists" cascade;`);
  }
}
