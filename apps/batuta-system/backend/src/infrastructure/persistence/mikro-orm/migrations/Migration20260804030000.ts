import { Migration } from '@mikro-orm/migrations';

/**
 * FASE 3 — contacts, imports, sender history and sender migrations.
 *
 * Notes on intent:
 *  - `contacts` unique on (account_id, phone_e164) IS the deduplication rule of §6.1 item 4. The
 *    database enforces it, so a concurrent import cannot create a second row for the same person.
 *  - `contacts.current_channel_id` is ON DELETE RESTRICT: a channel with contacts cannot be deleted
 *    out from under them. Re-homing goes through a migration (§6.4), never through a cascade.
 *  - `contact_sender_history` has no unique key on (contact, channel) on purpose: a contact may
 *    legitimately return to a channel it used before, and each stay is its own row.
 *  - `opted_out_at` has no path back to null in the application; the column is nullable only because
 *    "never opted out" has to be representable.
 */
export class Migration20260804030000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table "contact_imports" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "file_name" varchar(300) not null,
        "storage_key" varchar(500) not null,
        "uploaded_by" uuid not null,
        "consent_basis" varchar(30) not null,
        "origin_note" varchar(500) not null,
        "status" varchar(20) not null,
        "total_rows" int not null default 0,
        "processed_rows" int not null default 0,
        "imported_count" int not null default 0,
        "duplicated_count" int not null default 0,
        "invalid_count" int not null default 0,
        "missing_first_name_count" int not null default 0,
        "error_message" varchar(500) null,
        "finished_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        constraint "contact_imports_pkey" primary key ("id"),
        constraint "contact_imports_origin_note_not_blank" check (length(trim("origin_note")) >= 10),
        constraint "contact_imports_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict,
        constraint "contact_imports_uploaded_by_foreign" foreign key ("uploaded_by")
          references "users" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index "contact_imports_account_id_index" on "contact_imports" ("account_id");`,
    );
    this.addSql(
      `create index "contact_imports_account_id_created_at_index" on "contact_imports" ("account_id", "created_at");`,
    );

    this.addSql(`
      create table "contacts" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "phone_e164" varchar(20) not null,
        "name" varchar(200) null,
        "first_name" varchar(100) null,
        "tags" jsonb not null default '[]'::jsonb,
        "current_channel_id" uuid not null,
        "active" boolean not null default true,
        "opted_out_at" timestamptz null,
        "contact_import_id" uuid null,
        "created_at" timestamptz not null default now(),
        constraint "contacts_pkey" primary key ("id"),
        constraint "contacts_account_id_phone_e164_unique" unique ("account_id", "phone_e164"),
        constraint "contacts_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict,
        constraint "contacts_current_channel_id_foreign" foreign key ("current_channel_id")
          references "channels" ("id") on update cascade on delete restrict,
        constraint "contacts_contact_import_id_foreign" foreign key ("contact_import_id")
          references "contact_imports" ("id") on update cascade on delete set null
      );
    `);
    this.addSql(`create index "contacts_account_id_index" on "contacts" ("account_id");`);
    this.addSql(
      `create index "contacts_account_id_current_channel_id_index" on "contacts" ("account_id", "current_channel_id");`,
    );
    this.addSql(
      `create index "contacts_account_id_active_index" on "contacts" ("account_id", "active");`,
    );
    // Tag filtering drives the audience builder of FASE 6; jsonb needs GIN to be usable at scale.
    this.addSql(`create index "contacts_tags_gin_index" on "contacts" using gin ("tags");`);

    this.addSql(`
      create table "contact_import_errors" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "contact_import_id" uuid not null,
        "line_number" int not null,
        "reason" varchar(200) not null,
        "raw_value_masked" varchar(40) null,
        "created_at" timestamptz not null default now(),
        constraint "contact_import_errors_pkey" primary key ("id"),
        constraint "contact_import_errors_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict,
        constraint "contact_import_errors_contact_import_id_foreign" foreign key ("contact_import_id")
          references "contact_imports" ("id") on update cascade on delete cascade
      );
    `);
    this.addSql(
      `create index "contact_import_errors_contact_import_id_index" on "contact_import_errors" ("contact_import_id");`,
    );
    this.addSql(
      `create index "contact_import_errors_account_id_index" on "contact_import_errors" ("account_id");`,
    );

    this.addSql(`
      create table "sender_migrations" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "from_channel_id" uuid not null,
        "strategy" varchar(20) not null,
        "to_channel_id" uuid null,
        "contacts_affected" int not null default 0,
        "requested_by" uuid not null,
        "approved_by" uuid not null,
        "status" varchar(20) not null,
        "executed_at" timestamptz null,
        "failure_reason" varchar(500) null,
        "created_at" timestamptz not null default now(),
        constraint "sender_migrations_pkey" primary key ("id"),
        constraint "sender_migrations_all_to_one_needs_target"
          check ("strategy" <> 'ALL_TO_ONE' or "to_channel_id" is not null),
        constraint "sender_migrations_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict,
        constraint "sender_migrations_from_channel_id_foreign" foreign key ("from_channel_id")
          references "channels" ("id") on update cascade on delete restrict,
        constraint "sender_migrations_to_channel_id_foreign" foreign key ("to_channel_id")
          references "channels" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index "sender_migrations_account_id_created_at_index" on "sender_migrations" ("account_id", "created_at");`,
    );
    this.addSql(
      `create index "sender_migrations_account_id_index" on "sender_migrations" ("account_id");`,
    );

    this.addSql(`
      create table "contact_sender_history" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "contact_id" uuid not null,
        "channel_id" uuid not null,
        "assigned_at" timestamptz not null default now(),
        "released_at" timestamptz null,
        "reason" varchar(30) not null,
        "migration_id" uuid null,
        "created_at" timestamptz not null default now(),
        constraint "contact_sender_history_pkey" primary key ("id"),
        constraint "contact_sender_history_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict,
        constraint "contact_sender_history_contact_id_foreign" foreign key ("contact_id")
          references "contacts" ("id") on update cascade on delete cascade,
        constraint "contact_sender_history_channel_id_foreign" foreign key ("channel_id")
          references "channels" ("id") on update cascade on delete restrict,
        constraint "contact_sender_history_migration_id_foreign" foreign key ("migration_id")
          references "sender_migrations" ("id") on update cascade on delete set null
      );
    `);
    this.addSql(
      `create index "contact_sender_history_contact_id_assigned_at_index" on "contact_sender_history" ("contact_id", "assigned_at");`,
    );
    this.addSql(
      `create index "contact_sender_history_channel_id_index" on "contact_sender_history" ("channel_id");`,
    );
    this.addSql(
      `create index "contact_sender_history_account_id_index" on "contact_sender_history" ("account_id");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "contact_sender_history" cascade;`);
    this.addSql(`drop table if exists "sender_migrations" cascade;`);
    this.addSql(`drop table if exists "contact_import_errors" cascade;`);
    this.addSql(`drop table if exists "contacts" cascade;`);
    this.addSql(`drop table if exists "contact_imports" cascade;`);
  }
}
