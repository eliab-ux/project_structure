import { Migration } from '@mikro-orm/migrations';

/**
 * Duas mudanças que vieram da revisão da Fase 1 (spec §4.3 e §6.12).
 *
 * 1. **`user` → `app_user`.** `user` é palavra reservada no PostgreSQL, e o modo como ela falha é
 *    traiçoeiro: `select * from user` no psql não dá erro — devolve o usuário da CONEXÃO. Só
 *    funciona entre aspas, e basta um SQL escrito à mão sem elas para uma consulta silenciosamente
 *    errada passar por revisão. O rename acontece agora, enquanto não existe dado de produção;
 *    depois custaria janela de manutenção. A classe de domínio continua `User` — o problema é do
 *    banco, não do modelo.
 *
 * 2. **`user_phone_change_audit`.** Alterar o telefone de outro usuário equivale a tomar a conta
 *    dele: é para esse número que vai o código de recuperação de senha. A ação passa a ser
 *    exclusiva do `owner` e deixa trilha com autor, data, número antigo e número novo — sem o
 *    número ANTIGO a trilha não diz o que mudou, e é justamente ele que some do `app_user` no
 *    momento do update.
 *
 * O rename das constraints e índices é cosmético e vale o custo: o Postgres os mantém com o nome
 * antigo depois de renomear a tabela, e um `user_pkey` numa tabela `app_user` é a pista falsa que
 * faz alguém procurar uma tabela que não existe mais.
 */
export class Migration20260814140000 extends Migration {
  async up(): Promise<void> {
    this.addSql('alter table "user" rename to "app_user";');

    this.addSql('alter table "app_user" rename constraint "user_pkey" to "app_user_pkey";');
    this.addSql(
      'alter table "app_user" rename constraint "user_email_unique" to "app_user_email_unique";',
    );
    this.addSql(
      'alter table "app_user" rename constraint "user_role_check" to "app_user_role_check";',
    );
    this.addSql(
      'alter table "app_user" rename constraint "user_account_id_foreign" to "app_user_account_id_foreign";',
    );
    this.addSql('alter index "user_account_id_index" rename to "app_user_account_id_index";');

    // A FK de password_reset_code seguiu a tabela sozinha; só o nome dela é que ficou para trás.
    this.addSql(
      'alter table "password_reset_code" rename constraint "password_reset_code_user_id_foreign" to "password_reset_code_app_user_id_foreign";',
    );

    this.addSql(`
      create table "user_phone_change_audit" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "user_id" uuid not null,
        "changed_by_user_id" uuid not null,
        "previous_phone" varchar(20) not null,
        "new_phone" varchar(20) not null,
        "created_at" timestamptz not null default now(),
        constraint "user_phone_change_audit_pkey" primary key ("id"),
        constraint "user_phone_change_audit_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict,
        -- restrict nos dois lados, e não cascade: apagar a trilha junto com o usuário destruiria
        -- exatamente a evidência de um sequestro de conta. Usuário não é apagado de qualquer
        -- forma (é inativado), e a restrição garante isso também no banco.
        constraint "user_phone_change_audit_user_id_foreign" foreign key ("user_id")
          references "app_user" ("id") on update cascade on delete restrict,
        constraint "user_phone_change_audit_changed_by_foreign" foreign key ("changed_by_user_id")
          references "app_user" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`
      create index "user_phone_change_audit_user_index"
        on "user_phone_change_audit" ("user_id", "created_at" desc);
    `);
    this.addSql(
      `create index "user_phone_change_audit_account_id_index" on "user_phone_change_audit" ("account_id");`,
    );
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "user_phone_change_audit" cascade;');

    this.addSql(
      'alter table "password_reset_code" rename constraint "password_reset_code_app_user_id_foreign" to "password_reset_code_user_id_foreign";',
    );
    this.addSql('alter index "app_user_account_id_index" rename to "user_account_id_index";');
    this.addSql(
      'alter table "app_user" rename constraint "app_user_account_id_foreign" to "user_account_id_foreign";',
    );
    this.addSql(
      'alter table "app_user" rename constraint "app_user_role_check" to "user_role_check";',
    );
    this.addSql(
      'alter table "app_user" rename constraint "app_user_email_unique" to "user_email_unique";',
    );
    this.addSql('alter table "app_user" rename constraint "app_user_pkey" to "user_pkey";');
    this.addSql('alter table "app_user" rename to "user";');
  }
}
