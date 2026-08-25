import { Migration } from '@mikro-orm/migrations';

/**
 * FASE 4 — contents, variants and media assets.
 *
 * Notes on intent:
 *  - `classification` is NOT NULL with no default. §1.3 is explicit ("Sem default, sem nulo") and the
 *    column enforces it, so no future insert path can leave it unset.
 *  - `content_hash` is NOT NULL: a content with no hash could never be checked against an approval
 *    (§8.5), which would make the invalidation rule silently unenforceable.
 *  - variants and media CASCADE from the content: they are children of that aggregate, not
 *    independent records, and an orphan would corrupt the hash.
 *  - unique (content_id, label) on variants: two variants called "Zona Sul" in one content is a
 *    mistake that only shows up when the wrong one gets sent.
 */
export class Migration20260804040000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table "contents" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "title" varchar(200) not null,
        "classification" varchar(20) not null,
        "origin" varchar(20) not null,
        "body_base" text not null,
        "source_url" varchar(500) null,
        "status" varchar(20) not null,
        "content_hash" varchar(64) not null,
        "created_by" uuid not null,
        "approved_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        constraint "contents_pkey" primary key ("id"),
        constraint "contents_classification_check"
          check ("classification" in ('INSTITUTIONAL', 'ELECTORAL')),
        constraint "contents_approved_needs_timestamp"
          check ("status" <> 'APPROVED' or "approved_at" is not null),
        constraint "contents_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict,
        constraint "contents_created_by_foreign" foreign key ("created_by")
          references "users" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`create index "contents_account_id_index" on "contents" ("account_id");`);
    this.addSql(
      `create index "contents_account_id_status_index" on "contents" ("account_id", "status");`,
    );
    this.addSql(
      `create index "contents_account_id_classification_index" on "contents" ("account_id", "classification");`,
    );

    this.addSql(`
      create table "content_variants" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "content_id" uuid not null,
        "label" varchar(100) not null,
        "body" text not null,
        "position" int not null,
        "created_by" uuid not null,
        "reviewed_by" uuid null,
        "created_at" timestamptz not null default now(),
        constraint "content_variants_pkey" primary key ("id"),
        constraint "content_variants_content_id_label_unique" unique ("content_id", "label"),
        constraint "content_variants_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict,
        constraint "content_variants_content_id_foreign" foreign key ("content_id")
          references "contents" ("id") on update cascade on delete cascade,
        constraint "content_variants_created_by_foreign" foreign key ("created_by")
          references "users" ("id") on update cascade on delete restrict,
        constraint "content_variants_reviewed_by_foreign" foreign key ("reviewed_by")
          references "users" ("id") on update cascade on delete set null
      );
    `);
    this.addSql(
      `create index "content_variants_content_id_position_index" on "content_variants" ("content_id", "position");`,
    );
    this.addSql(
      `create index "content_variants_account_id_index" on "content_variants" ("account_id");`,
    );

    this.addSql(`
      create table "media_assets" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "content_id" uuid not null,
        "variant_id" uuid null,
        "kind" varchar(20) not null,
        "storage_key" varchar(500) not null,
        "mime_type" varchar(120) not null,
        "size_bytes" bigint not null,
        "original_name" varchar(300) not null,
        "created_at" timestamptz not null default now(),
        constraint "media_assets_pkey" primary key ("id"),
        constraint "media_assets_size_positive" check ("size_bytes" > 0),
        constraint "media_assets_account_id_foreign" foreign key ("account_id")
          references "accounts" ("id") on update cascade on delete restrict,
        constraint "media_assets_content_id_foreign" foreign key ("content_id")
          references "contents" ("id") on update cascade on delete cascade,
        constraint "media_assets_variant_id_foreign" foreign key ("variant_id")
          references "content_variants" ("id") on update cascade on delete cascade
      );
    `);
    this.addSql(`create index "media_assets_content_id_index" on "media_assets" ("content_id");`);
    this.addSql(`create index "media_assets_account_id_index" on "media_assets" ("account_id");`);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "media_assets" cascade;`);
    this.addSql(`drop table if exists "content_variants" cascade;`);
    this.addSql(`drop table if exists "contents" cascade;`);
  }
}
