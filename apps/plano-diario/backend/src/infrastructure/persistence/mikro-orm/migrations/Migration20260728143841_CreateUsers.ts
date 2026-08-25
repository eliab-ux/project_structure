import { Migration } from '@mikro-orm/migrations';

export class Migration20260728143841_CreateUsers extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "users" ("id" uuid not null, "email" varchar(255) not null, "password_hash" varchar(255) not null, "name" varchar(120) not null, "role" varchar(20) not null default 'user', "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "users_pkey" primary key ("id"));`,
    );
    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "users" cascade;`);
  }
}
