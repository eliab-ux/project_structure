import { Migration } from '@mikro-orm/migrations';

/**
 * KIT — `product_components` (§2.5 do 03, "bundle volta ao Produto"). A composição de um kit; o kit
 * não tem saldo próprio (o disponível é derivado dos componentes pelo EST). Tabela de TENANT com RLS.
 * Migration ADITIVA.
 *
 * Grant COM update (a substituição marca as antigas com `deleted_at`), SEM delete. Único parcial
 * `(parent, component)` onde `deleted_at is null`: um componente não se repete na composição viva.
 */
export class Migration20260822170000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table if not exists "product_components" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "parent_product_id" uuid not null,
        "component_product_id" uuid not null,
        "quantity" numeric(14,3) not null,
        constraint "product_components_pkey" primary key ("id"),
        constraint "product_components_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "product_components_parent_foreign" foreign key ("parent_product_id") references "products" ("id") on update cascade on delete cascade,
        constraint "product_components_component_foreign" foreign key ("component_product_id") references "products" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index if not exists "product_components_account_id_index" on "product_components" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "product_components_parent_index" on "product_components" ("parent_product_id");`,
    );
    this.addSql(`
      create unique index if not exists "product_components_parent_component_unique"
        on "product_components" ("parent_product_id", "component_product_id")
        where "deleted_at" is null;
    `);

    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;
    this.addSql(`alter table "product_components" enable row level security;`);
    this.addSql(
      `drop policy if exists "product_components_tenant_isolation" on "product_components";`,
    );
    this.addSql(`
      create policy "product_components_tenant_isolation" on "product_components"
        for all
        using ("account_id" = ${tenantScope})
        with check ("account_id" = ${tenantScope});
    `);

    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert, update on table public.product_components to veertex_app;
        end if;
      end
      $$;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "product_components" cascade;`);
  }
}
