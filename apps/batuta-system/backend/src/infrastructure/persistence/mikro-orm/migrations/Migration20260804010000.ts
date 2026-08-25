import { Migration } from '@mikro-orm/migrations';

/**
 * FASE 1 — tenant, users, platform admins, audit trail, password reset, abuse signals.
 *
 * Notes on intent:
 *  - `accounts` and `platform_admins` are the only tables without `account_id` (§4).
 *  - `audit_logs` is append-only. Postgres has no "append-only" flag, so the guarantee is
 *    enforced in the repository (no update/delete) and pinned by test. A revoke of
 *    UPDATE/DELETE at the role level is the belt-and-braces step for production and is
 *    intentionally NOT done here: it would depend on the role name of the environment.
 *  - Every FK to `accounts` is ON DELETE RESTRICT: a tenant is never silently erased along
 *    with its trail.
 */
export class Migration20260804010000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table "accounts" (
        "id" uuid not null default gen_random_uuid(),
        "name" varchar(200) not null,
        "document" varchar(14) not null,
        "plan" varchar(20) not null,
        "status" varchar(20) not null,
        "daily_send_ceiling" int not null,
        "timezone" varchar(64) not null default 'America/Sao_Paulo',
        "evolution_server_url" varchar(300) null,
        "evolution_api_key" varchar(300) null,
        "suspended_at" timestamptz null,
        "suspension_reason" varchar(500) null,
        "created_at" timestamptz not null default now(),
        constraint "accounts_pkey" primary key ("id"),
        constraint "accounts_daily_send_ceiling_positive" check ("daily_send_ceiling" > 0)
      );
    `);
    this.addSql(`create index "accounts_document_index" on "accounts" ("document");`);
    this.addSql(`create index "accounts_status_index" on "accounts" ("status");`);

    this.addSql(`
      create table "platform_admins" (
        "id" uuid not null default gen_random_uuid(),
        "name" varchar(200) not null,
        "email" varchar(255) not null,
        "password_hash" varchar(100) not null,
        "active" boolean not null default true,
        "last_login_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        constraint "platform_admins_pkey" primary key ("id"),
        constraint "platform_admins_email_unique" unique ("email")
      );
    `);

    this.addSql(`
      create table "users" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "name" varchar(200) not null,
        "email" varchar(255) not null,
        "password_hash" varchar(100) not null,
        "role" varchar(20) not null,
        "status" varchar(20) not null,
        "last_login_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        constraint "users_pkey" primary key ("id"),
        constraint "users_account_id_email_unique" unique ("account_id", "email"),
        constraint "users_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`create index "users_account_id_index" on "users" ("account_id");`);
    this.addSql(`create index "users_email_index" on "users" ("email");`);

    this.addSql(`
      create table "password_reset_tokens" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "user_id" uuid not null,
        "token_hash" varchar(64) not null,
        "expires_at" timestamptz not null,
        "used_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        constraint "password_reset_tokens_pkey" primary key ("id"),
        constraint "password_reset_tokens_token_hash_unique" unique ("token_hash"),
        constraint "password_reset_tokens_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict,
        constraint "password_reset_tokens_user_id_foreign" foreign key ("user_id")
          references "users" ("id") on update cascade on delete cascade
      );
    `);
    this.addSql(
      `create index "password_reset_tokens_account_id_index" on "password_reset_tokens" ("account_id");`,
    );
    this.addSql(
      `create index "password_reset_tokens_user_id_index" on "password_reset_tokens" ("user_id");`,
    );

    this.addSql(`
      create table "audit_logs" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid null,
        "actor_type" varchar(20) not null,
        "actor_id" uuid null,
        "action" varchar(50) not null,
        "entity_type" varchar(100) null,
        "entity_id" uuid null,
        "payload" jsonb not null default '{}'::jsonb,
        "ip" varchar(64) null,
        "created_at" timestamptz not null default now(),
        constraint "audit_logs_pkey" primary key ("id"),
        constraint "audit_logs_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index "audit_logs_account_id_created_at_index" on "audit_logs" ("account_id", "created_at");`,
    );
    this.addSql(
      `create index "audit_logs_account_id_action_index" on "audit_logs" ("account_id", "action");`,
    );

    this.addSql(`
      create table "account_abuse_signals" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "date" date not null,
        "sent_count" int not null default 0,
        "failed_count" int not null default 0,
        "delivered_count" int not null default 0,
        "opt_out_count" int not null default 0,
        "inbound_count" int not null default 0,
        "previous_day_sent_count" int not null default 0,
        "created_at" timestamptz not null default now(),
        constraint "account_abuse_signals_pkey" primary key ("id"),
        constraint "account_abuse_signals_account_id_date_unique" unique ("account_id", "date"),
        constraint "account_abuse_signals_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index "account_abuse_signals_account_id_index" on "account_abuse_signals" ("account_id");`,
    );
    this.addSql(
      `create index "account_abuse_signals_date_index" on "account_abuse_signals" ("date");`,
    );
  }

  async down(): Promise<void> {
    // Reverse order of creation because of the foreign keys.
    this.addSql(`drop table if exists "account_abuse_signals" cascade;`);
    this.addSql(`drop table if exists "audit_logs" cascade;`);
    this.addSql(`drop table if exists "password_reset_tokens" cascade;`);
    this.addSql(`drop table if exists "users" cascade;`);
    this.addSql(`drop table if exists "platform_admins" cascade;`);
    this.addSql(`drop table if exists "accounts" cascade;`);
  }
}
