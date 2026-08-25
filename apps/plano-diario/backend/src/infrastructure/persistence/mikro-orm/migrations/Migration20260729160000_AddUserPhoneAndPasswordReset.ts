import { Migration } from '@mikro-orm/migrations';

export class Migration20260729160000_AddUserPhoneAndPasswordReset extends Migration {
  override async up(): Promise<void> {
    // Anulável de propósito: as contas que já existem não têm número, e preencher com um valor
    // inventado quebraria a recuperação de senha de um jeito silencioso. O cadastro novo exige o
    // campo na aplicação; quem já tem conta preenche na tela de configuração.
    this.addSql(`alter table "users" add column "phone" varchar(20) null;`);

    this.addSql(
      `create table "password_reset_codes" ("id" uuid not null, "user_id" uuid not null, "code_hash" varchar(255) not null, "expires_at" timestamptz not null, "used_at" timestamptz null, "attempts" int not null default 0, "created_at" timestamptz not null, constraint "password_reset_codes_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "password_reset_codes" add constraint "password_reset_codes_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`,
    );
    // A busca é sempre "o código vivo deste usuário" e "quantos ele pediu na última hora".
    this.addSql(
      `create index "password_reset_codes_user_id_created_at_index" on "password_reset_codes" ("user_id", "created_at");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "password_reset_codes" cascade;`);
    this.addSql(`alter table "users" drop column if exists "phone";`);
  }
}
