import { Migration } from '@mikro-orm/migrations';

export class Migration20260728174856_CreateWhatsappInstances extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "whatsapp_instances" ("id" uuid not null, "user_id" uuid not null, "instance_name" varchar(120) not null, "instance_token" text not null, "status" varchar(30) not null, "connected_number" varchar(30) null, "last_status_at" timestamptz not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "whatsapp_instances_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "whatsapp_instances" add constraint "whatsapp_instances_user_id_unique" unique ("user_id");`,
    );
    this.addSql(
      `alter table "whatsapp_instances" add constraint "whatsapp_instances_instance_name_unique" unique ("instance_name");`,
    );
    this.addSql(
      `create index "whatsapp_instances_status_index" on "whatsapp_instances" ("status");`,
    );
    // FK no banco (spec §4.2) sem relação no nível do ORM: o context `whatsapp` não conhece a
    // entidade ORM de `user`. ON DELETE CASCADE porque a conexão não faz sentido sem o dono.
    this.addSql(
      `alter table "whatsapp_instances" add constraint "whatsapp_instances_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "whatsapp_instances" cascade;`);
  }
}
