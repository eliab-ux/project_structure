import { Migration } from '@mikro-orm/migrations';

/**
 * COB (06 §3): config do provedor (credenciais CIFRADAS), charges (instrumento boleto/Pix),
 * régua (regras + eventos append-only) e a idempotência do webhook (id externo único por conta —
 * aceite 3: mesma notificação duas vezes = uma baixa). Tenant + RLS em todas; eventos de régua e
 * de webhook sem UPDATE further do que a aprovação exige (a imutabilidade é do banco).
 */
export class Migration20260824030000 extends Migration {
  async up(): Promise<void> {
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    this.addSql(`
      create table if not exists "billing_provider_configs" (
        "id" uuid primary key,
        "account_id" uuid not null,
        "company_id" uuid null,
        "provider" varchar(30) not null,
        "encrypted_credentials" text not null,
        "agreement_code" varchar(60) null,
        "settlement_account_id" uuid not null,
        "active" boolean not null default true,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null
      );
    `);

    this.addSql(`
      create table if not exists "charges" (
        "id" uuid primary key,
        "account_id" uuid not null,
        "company_id" uuid not null,
        "title_id" uuid not null,
        "kind" varchar(10) not null,
        "status" varchar(20) not null,
        "provider" varchar(30) not null,
        "provider_charge_id" varchar(120) null,
        "digitable_line" varchar(80) null,
        "pix_qr_code" text null,
        "pdf_object_key" varchar(300) null,
        "paid_at" timestamptz null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null
      );
    `);
    this.addSql(
      `create index if not exists "charges_title_idx" on "charges" ("account_id", "title_id");`,
    );
    this.addSql(`
      create unique index if not exists "charges_active_per_title_uq"
        on "charges" ("account_id", "title_id")
        where "status" = 'registered' and "deleted_at" is null;
    `);

    this.addSql(`
      create table if not exists "dunning_rules" (
        "id" uuid primary key,
        "account_id" uuid not null,
        "steps" jsonb not null,
        "max_rebillings" int not null default 3,
        "active" boolean not null default true,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null
      );
    `);

    this.addSql(`
      create table if not exists "dunning_events" (
        "id" uuid primary key,
        "account_id" uuid not null,
        "title_id" uuid not null,
        "step_id" uuid not null,
        "offset_days" int not null,
        "channel" varchar(20) not null,
        "rendered_message" text not null,
        "status" varchar(20) not null,
        "sent_at" timestamptz null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null
      );
    `);
    this.addSql(
      `create index if not exists "dunning_events_title_idx" on "dunning_events" ("account_id", "title_id");`,
    );

    this.addSql(`
      create table if not exists "billing_webhook_events" (
        "id" uuid primary key,
        "account_id" uuid not null,
        "external_event_id" varchar(160) not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null
      );
    `);
    this.addSql(`
      create unique index if not exists "billing_webhook_events_uq"
        on "billing_webhook_events" ("account_id", "external_event_id");
    `);

    for (const table of [
      'billing_provider_configs',
      'charges',
      'dunning_rules',
      'dunning_events',
      'billing_webhook_events',
    ]) {
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
    for (const table of [
      'billing_webhook_events',
      'dunning_events',
      'dunning_rules',
      'charges',
      'billing_provider_configs',
    ]) {
      this.addSql(`drop table if exists "${table}";`);
    }
  }
}
