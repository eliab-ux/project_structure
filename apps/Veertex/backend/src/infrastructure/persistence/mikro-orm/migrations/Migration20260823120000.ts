import { Migration } from '@mikro-orm/migrations';

/**
 * ROT fatia 2 (§04) — `routes` (cadastro de rota) + `commercial_rules` (perfil do representante) +
 * `contacts.route_id` (carteirização do revendedor por rota; o `sales_rep_id` da carteira já existe
 * desde o ADR-0007). Tabelas de TENANT com RLS (cobertas pelo `verify:isolation`). Grant COM update
 * (editar/desativar), SEM delete. `route_id` entra nullable numa tabela que já tem linhas.
 */
export class Migration20260823120000 extends Migration {
  async up(): Promise<void> {
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    // ── routes ──────────────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "routes" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "name" varchar(120) not null,
        "code" varchar(40) null,
        "active" boolean not null default true,
        constraint "routes_pkey" primary key ("id"),
        constraint "routes_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade
      );
    `);
    this.addSql(`create index if not exists "routes_account_id_index" on "routes" ("account_id");`);

    // ── commercial_rules ────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "commercial_rules" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "user_id" uuid not null,
        "allowed_company_ids" jsonb not null default '[]',
        "allowed_payment_condition_ids" jsonb not null default '[]',
        "allowed_price_list_ids" jsonb not null default '[]',
        "allowed_operation_natures" jsonb not null default '[]',
        constraint "commercial_rules_pkey" primary key ("id"),
        constraint "commercial_rules_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "commercial_rules_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade
      );
    `);
    this.addSql(
      `create index if not exists "commercial_rules_account_id_index" on "commercial_rules" ("account_id");`,
    );
    this.addSql(`
      create unique index if not exists "commercial_rules_account_user_unique"
        on "commercial_rules" ("account_id", "user_id")
        where "deleted_at" is null;
    `);

    // ── contacts.route_id ───────────────────────────────────────────────────────────────────────
    this.addSql(`alter table "contacts" add column if not exists "route_id" uuid null;`);
    this.addSql(`
      alter table "contacts"
        add constraint "contacts_route_id_foreign" foreign key ("route_id")
        references "routes" ("id") on update cascade on delete set null;
    `);
    this.addSql(`create index if not exists "contacts_route_id_index" on "contacts" ("route_id");`);

    for (const table of ['routes', 'commercial_rules']) {
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
    this.addSql(`alter table "contacts" drop constraint if exists "contacts_route_id_foreign";`);
    this.addSql(`drop index if exists "contacts_route_id_index";`);
    this.addSql(`alter table "contacts" drop column if exists "route_id";`);
    this.addSql(`drop table if exists "commercial_rules" cascade;`);
    this.addSql(`drop table if exists "routes" cascade;`);
  }
}
