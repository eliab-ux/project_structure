import { Migration } from '@mikro-orm/migrations';

/**
 * FASE 2 — channels, daily counters and quality snapshots.
 *
 * Notes on intent:
 *  - `channels.phone_e164` is unique per account: one chip is one channel, and the same number can
 *    never be two senders inside a tenant.
 *  - `evolution_instance_name` is globally unique, which is the database half of the namespacing
 *    rule (§5 FASE 2 item 2) — two tenants cannot collide on a shared Evolution server.
 *  - `current_quota` sits between floor and ceiling by CHECK constraint, so even a bad write from
 *    outside the domain cannot leave a channel able to send above its band.
 *  - `channel_daily_counters` is the source of truth for quota; the unique (channel, date) is what
 *    makes the atomic INSERT … ON CONFLICT increment of FASE 7 possible.
 */
export class Migration20260804020000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table "channels" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "label" varchar(120) not null,
        "phone_e164" varchar(20) not null,
        "evolution_instance_name" varchar(120) not null,
        "status" varchar(20) not null,
        "warmup_started_at" timestamptz null,
        "current_quota" int not null,
        "quota_floor" int not null,
        "quota_ceiling" int not null,
        "consecutive_failures" int not null default 0,
        "last_send_at" timestamptz null,
        "last_quota_review_at" timestamptz null,
        "disconnect_events_today" int not null default 0,
        "last_disconnect_at" timestamptz null,
        "retired_at" timestamptz null,
        "retired_by" uuid null,
        "terminal_reason" varchar(500) null,
        "created_at" timestamptz not null default now(),
        constraint "channels_pkey" primary key ("id"),
        constraint "channels_account_id_phone_e164_unique" unique ("account_id", "phone_e164"),
        constraint "channels_evolution_instance_name_unique" unique ("evolution_instance_name"),
        constraint "channels_quota_band_check" check ("quota_floor" > 0 and "quota_ceiling" >= "quota_floor"),
        constraint "channels_current_quota_within_band_check"
          check ("current_quota" >= "quota_floor" and "current_quota" <= "quota_ceiling"),
        constraint "channels_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`create index "channels_account_id_index" on "channels" ("account_id");`);
    this.addSql(
      `create index "channels_account_id_status_index" on "channels" ("account_id", "status");`,
    );

    this.addSql(`
      create table "channel_daily_counters" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "channel_id" uuid not null,
        "date" date not null,
        "campaign_sends" int not null default 0,
        "reply_sends" int not null default 0,
        "created_at" timestamptz not null default now(),
        constraint "channel_daily_counters_pkey" primary key ("id"),
        constraint "channel_daily_counters_channel_id_date_unique" unique ("channel_id", "date"),
        constraint "channel_daily_counters_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict,
        constraint "channel_daily_counters_channel_id_foreign" foreign key ("channel_id")
          references "channels" ("id") on update cascade on delete cascade
      );
    `);
    this.addSql(
      `create index "channel_daily_counters_account_id_date_index" on "channel_daily_counters" ("account_id", "date");`,
    );
    this.addSql(
      `create index "channel_daily_counters_account_id_index" on "channel_daily_counters" ("account_id");`,
    );

    this.addSql(`
      create table "channel_quality_snapshots" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "channel_id" uuid not null,
        "date" date not null,
        "sent_count" int not null default 0,
        "failed_count" int not null default 0,
        "delivered_count" int not null default 0,
        "inbound_count" int not null default 0,
        "opt_out_count" int not null default 0,
        "disconnect_events" int not null default 0,
        "computed_quota" int not null,
        "decision" varchar(10) not null,
        "reason" varchar(500) not null,
        "created_at" timestamptz not null default now(),
        constraint "channel_quality_snapshots_pkey" primary key ("id"),
        constraint "channel_quality_snapshots_channel_id_date_unique" unique ("channel_id", "date"),
        constraint "channel_quality_snapshots_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict,
        constraint "channel_quality_snapshots_channel_id_foreign" foreign key ("channel_id")
          references "channels" ("id") on update cascade on delete cascade
      );
    `);
    this.addSql(
      `create index "channel_quality_snapshots_account_id_date_index" on "channel_quality_snapshots" ("account_id", "date");`,
    );
    this.addSql(
      `create index "channel_quality_snapshots_account_id_index" on "channel_quality_snapshots" ("account_id");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "channel_quality_snapshots" cascade;`);
    this.addSql(`drop table if exists "channel_daily_counters" cascade;`);
    this.addSql(`drop table if exists "channels" cascade;`);
  }
}
