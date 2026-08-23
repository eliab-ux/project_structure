import { Migration } from '@mikro-orm/migrations';

/**
 * VND — `payment_conditions` (§4.2 do 02A): condições de pagamento nomeadas. Tabela de TENANT com RLS
 * (coberta pelo `verify:isolation`). Tem ciclo de vida (rename/deactivate) → grant COM update, SEM
 * delete: uma condição já usada em pedido não se apaga, desativa-se.
 */
export class Migration20260822200000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table if not exists "payment_conditions" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "name" varchar(120) not null,
        "kind" varchar(20) not null,
        "active" boolean not null default true,
        constraint "payment_conditions_pkey" primary key ("id"),
        constraint "payment_conditions_kind_check" check ("kind" in
          ('promissoria','a_vista','cartao','cheque_pre','pix','boleto')),
        constraint "payment_conditions_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade
      );
    `);
    this.addSql(
      `create index if not exists "payment_conditions_account_id_index" on "payment_conditions" ("account_id");`,
    );

    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;
    this.addSql(`alter table "payment_conditions" enable row level security;`);
    this.addSql(
      `drop policy if exists "payment_conditions_tenant_isolation" on "payment_conditions";`,
    );
    this.addSql(`
      create policy "payment_conditions_tenant_isolation" on "payment_conditions"
        for all
        using ("account_id" = ${tenantScope})
        with check ("account_id" = ${tenantScope});
    `);
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert, update on table public.payment_conditions to veertex_app;
        end if;
      end
      $$;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_conditions" cascade;`);
  }
}
