import { Migration } from '@mikro-orm/migrations';

/**
 * ROT fatia 5 (§04, fechamento) — `trip_expenses` (despesas diárias por categoria) e
 * `commission_b_tiers` (faixas do Modelo B por conta). Tenant + RLS (cobertas pelo
 * `verify:isolation`). Despesa é APPEND (lançamento diário; estorno = ação futura, sem update);
 * faixas trocam em bloco (soft-delete + insert) → grant com update.
 */
export class Migration20260823150000 extends Migration {
  async up(): Promise<void> {
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    this.addSql(`
      create table if not exists "trip_expenses" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "trip_id" uuid not null,
        "category" varchar(20) not null,
        "amount" numeric(14,2) not null,
        "note" text null,
        "spent_at" timestamptz not null,
        constraint "trip_expenses_pkey" primary key ("id"),
        constraint "trip_expenses_category_check" check ("category" in
          ('combustivel','alimentacao','hotel','pedagio','manutencao','outros')),
        constraint "trip_expenses_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "trip_expenses_trip_foreign" foreign key ("trip_id") references "trips" ("id") on update cascade on delete cascade
      );
    `);
    this.addSql(
      `create index if not exists "trip_expenses_account_id_index" on "trip_expenses" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "trip_expenses_trip_index" on "trip_expenses" ("trip_id");`,
    );

    this.addSql(`
      create table if not exists "commission_b_tiers" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "threshold_percent" numeric(8,2) not null,
        "commission_percent" numeric(6,2) not null,
        constraint "commission_b_tiers_pkey" primary key ("id"),
        constraint "commission_b_tiers_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade
      );
    `);
    this.addSql(
      `create index if not exists "commission_b_tiers_account_id_index" on "commission_b_tiers" ("account_id");`,
    );

    for (const table of ['trip_expenses', 'commission_b_tiers']) {
      this.addSql(`alter table "${table}" enable row level security;`);
      this.addSql(`drop policy if exists "${table}_tenant_isolation" on "${table}";`);
      this.addSql(`
        create policy "${table}_tenant_isolation" on "${table}"
          for all
          using ("account_id" = ${tenantScope})
          with check ("account_id" = ${tenantScope});
      `);
    }
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert on table public.trip_expenses to veertex_app;
          grant select, insert, update on table public.commission_b_tiers to veertex_app;
        end if;
      end
      $$;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "commission_b_tiers" cascade;`);
    this.addSql(`drop table if exists "trip_expenses" cascade;`);
  }
}
