import { Migration } from '@mikro-orm/migrations';

export class Migration20260728180522_CreateWhatsappGroups extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "whatsapp_groups" ("id" uuid not null, "user_id" uuid not null, "instance_id" uuid not null, "group_jid" varchar(120) not null, "name" varchar(255) not null, "participants_count" int null, "synced_at" timestamptz not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "whatsapp_groups_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "whatsapp_groups_user_id_index" on "whatsapp_groups" ("user_id");`);
    this.addSql(
      `alter table "whatsapp_groups" add constraint "whatsapp_groups_user_id_group_jid_unique" unique ("user_id", "group_jid");`,
    );

    this.addSql(
      `alter table "whatsapp_groups" add constraint "whatsapp_groups_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "whatsapp_groups" add constraint "whatsapp_groups_instance_id_foreign" foreign key ("instance_id") references "whatsapp_instances" ("id") on update cascade on delete cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "whatsapp_groups" cascade;`);
  }
}
