import { Migration } from '@mikro-orm/migrations';

/**
 * VND/Comissão — `commission_a_tiers` (faixas do Modelo A, por conta) e `sales_targets` (meta por
 * vendedor × período), §2 do 02A. Ambas de TENANT com RLS (cobertas pelo `verify:isolation`). Grant
 * COM update (editar meta), SEM delete — as faixas trocam por soft-delete + insert.
 *
 * `sales_targets` é único por `(account_id, user_id, period)` (índice parcial ignorando soft-deletados).
 */
export class Migration20260822230000 extends Migration {
  async up(): Promise<void> {
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    // ── commission_a_tiers ──────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "commission_a_tiers" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "threshold_percent" numeric(8,2) not null,
        "commission_percent" numeric(6,2) not null,
        constraint "commission_a_tiers_pkey" primary key ("id"),
        constraint "commission_a_tiers_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade
      );
    `);
    this.addSql(
      `create index if not exists "commission_a_tiers_account_id_index" on "commission_a_tiers" ("account_id");`,
    );

    // ── sales_targets ───────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "sales_targets" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "user_id" uuid not null,
        "period" varchar(7) not null,
        "target_value" numeric(14,2) not null,
        constraint "sales_targets_pkey" primary key ("id"),
        constraint "sales_targets_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "sales_targets_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index if not exists "sales_targets_account_id_index" on "sales_targets" ("account_id");`,
    );
    this.addSql(`
      create unique index if not exists "sales_targets_account_user_period_unique"
        on "sales_targets" ("account_id", "user_id", "period")
        where "deleted_at" is null;
    `);

    // ── RLS + grants (as duas tabelas) ──────────────────────────────────────────────────────────
    for (const table of ['commission_a_tiers', 'sales_targets']) {
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
    this.addSql(`drop table if exists "sales_targets" cascade;`);
    this.addSql(`drop table if exists "commission_a_tiers" cascade;`);
  }
}
