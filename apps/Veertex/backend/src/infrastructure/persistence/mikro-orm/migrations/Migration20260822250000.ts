import { Migration } from '@mikro-orm/migrations';

/**
 * FIN fatia 1 (§05) — `financial_accounts` (caixa/banco/integração) e `financial_categories` (árvore
 * receita×despesa×neutra, com dre_line e default por operação). Ambas de TENANT com RLS (cobertas
 * pelo `verify:isolation`). Grant COM update (editar/desativar), SEM delete.
 */
export class Migration20260822250000 extends Migration {
  async up(): Promise<void> {
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    // ── financial_accounts ──────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "financial_accounts" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "name" varchar(120) not null,
        "type" varchar(20) not null,
        "institution" varchar(120) null,
        "initial_balance" numeric(14,2) not null default 0,
        "automatic" boolean not null default false,
        "active" boolean not null default true,
        constraint "financial_accounts_pkey" primary key ("id"),
        constraint "financial_accounts_type_check" check ("type" in ('cash','bank','payment_integration')),
        constraint "financial_accounts_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade
      );
    `);
    this.addSql(
      `create index if not exists "financial_accounts_account_id_index" on "financial_accounts" ("account_id");`,
    );

    // ── financial_categories ────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "financial_categories" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "name" varchar(120) not null,
        "kind" varchar(10) not null,
        "parent_id" uuid null,
        "dre_line" varchar(60) null,
        "default_operation" varchar(20) null,
        "active" boolean not null default true,
        constraint "financial_categories_pkey" primary key ("id"),
        constraint "financial_categories_kind_check" check ("kind" in ('revenue','expense','neutral')),
        constraint "financial_categories_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "financial_categories_parent_foreign" foreign key ("parent_id") references "financial_categories" ("id") on update cascade on delete set null
      );
    `);
    this.addSql(
      `create index if not exists "financial_categories_account_id_index" on "financial_categories" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "financial_categories_parent_index" on "financial_categories" ("parent_id");`,
    );

    for (const table of ['financial_accounts', 'financial_categories']) {
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
    this.addSql(`drop table if exists "financial_categories" cascade;`);
    this.addSql(`drop table if exists "financial_accounts" cascade;`);
  }
}
