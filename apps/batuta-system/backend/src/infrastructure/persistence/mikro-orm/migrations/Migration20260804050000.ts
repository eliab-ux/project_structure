import { Migration } from '@mikro-orm/migrations';

/**
 * FASE 5 — approval settings, approvers and approval requests.
 *
 * Notes on intent:
 *  - `approval_settings` is unique per account: one policy per tenant, with the institutional and
 *    electoral counts side by side, and a CHECK pinning them to 1 or 2 (§8 item 1).
 *  - `approvers` has NO `user_id`. "Aprovador não precisa ter conta de usuário" (§8 item 2), so the
 *    only identity is name + contact, and a CHECK guarantees at least one contact exists — an
 *    unreachable approver would silently block every submission.
 *  - `approval_requests.token_hash` is unique: the magic-link token is the credential for a public
 *    route, stored hashed, single use.
 *  - `content_hash` lives on the request, next to `decided_*`, because the record has to say WHICH
 *    version was approved (§8 item 4).
 *  - ON DELETE RESTRICT from approvers: deactivation is the way out, because past decisions point here
 *    and a decision whose approver vanished is unauditable.
 */
export class Migration20260804050000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table "approval_settings" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "required_for_institutional" int not null default 1,
        "required_for_electoral" int not null default 2,
        "notify_channel" varchar(20) not null default 'EMAIL',
        "created_at" timestamptz not null default now(),
        constraint "approval_settings_pkey" primary key ("id"),
        constraint "approval_settings_account_id_unique" unique ("account_id"),
        constraint "approval_settings_required_institutional_check"
          check ("required_for_institutional" in (1, 2)),
        constraint "approval_settings_required_electoral_check"
          check ("required_for_electoral" in (1, 2)),
        constraint "approval_settings_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict
      );
    `);

    this.addSql(`
      create table "approvers" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "name" varchar(200) not null,
        "email" varchar(255) null,
        "phone_e164" varchar(20) null,
        "active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        constraint "approvers_pkey" primary key ("id"),
        constraint "approvers_needs_a_contact"
          check ("email" is not null or "phone_e164" is not null),
        constraint "approvers_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`create index "approvers_account_id_index" on "approvers" ("account_id");`);
    this.addSql(
      `create index "approvers_account_id_active_index" on "approvers" ("account_id", "active");`,
    );
    // One approver per e-mail per account. Partial, because e-mail is nullable.
    this.addSql(`
      create unique index "approvers_account_id_email_unique"
        on "approvers" ("account_id", lower("email")) where "email" is not null;
    `);

    this.addSql(`
      create table "approval_requests" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "content_id" uuid not null,
        "content_hash" varchar(64) not null,
        "approver_id" uuid not null,
        "token_hash" varchar(64) not null,
        "expires_at" timestamptz not null,
        "status" varchar(20) not null,
        "decided_at" timestamptz null,
        "decided_ip" varchar(64) null,
        "decided_user_agent" varchar(300) null,
        "comment" text null,
        "created_at" timestamptz not null default now(),
        constraint "approval_requests_pkey" primary key ("id"),
        constraint "approval_requests_token_hash_unique" unique ("token_hash"),
        constraint "approval_requests_decided_needs_timestamp"
          check ("status" not in ('APPROVED', 'REJECTED') or "decided_at" is not null),
        constraint "approval_requests_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict,
        constraint "approval_requests_content_id_foreign" foreign key ("content_id")
          references "contents" ("id") on update cascade on delete cascade,
        constraint "approval_requests_approver_id_foreign" foreign key ("approver_id")
          references "approvers" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index "approval_requests_content_id_status_index" on "approval_requests" ("content_id", "status");`,
    );
    this.addSql(
      `create index "approval_requests_account_id_status_index" on "approval_requests" ("account_id", "status");`,
    );
    this.addSql(
      `create index "approval_requests_account_id_index" on "approval_requests" ("account_id");`,
    );
    // The expiry sweep looks for pending requests past their date.
    this.addSql(`
      create index "approval_requests_pending_expiry_index"
        on "approval_requests" ("expires_at") where "status" = 'PENDING';
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "approval_requests" cascade;`);
    this.addSql(`drop table if exists "approvers" cascade;`);
    this.addSql(`drop table if exists "approval_settings" cascade;`);
  }
}
