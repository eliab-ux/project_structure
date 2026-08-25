import { Migration } from '@mikro-orm/migrations';

/**
 * Recuperação de senha por CÓDIGO no WhatsApp (CLAUDE.md — *Recuperação de Senha por Código no
 * WhatsApp*), substituindo o link por e-mail.
 *
 * Três mudanças, cada uma com um motivo:
 *
 *  1. **`users.phone`** — o WhatsApp passa a ser parte da identidade de quem faz login (regra 9 do
 *     CLAUDE.md). Entra **nullable** porque a tabela pode já ter linhas, e telefone não se deduz:
 *     não há backfill possível. É a exceção que a própria regra 9 documenta. Todo usuário criado
 *     pela API a partir daqui tem número — o DTO exige. As linhas antigas ficam sem, e para elas a
 *     recuperação por código simplesmente não funciona (o use case trata isso em silêncio, sem
 *     revelar nada a quem pediu). Preencha-as com `PATCH /users/:id/phone`.
 *
 *  2. **`password_reset_codes`** — seis dígitos guardados **só como hash bcrypt**, uso único, com
 *     `attempts` para limitar força bruta e `sent_at` separado de `created_at`. Os dois campos de
 *     data existem separados de propósito: o limite por hora conta ENVIOS, e um código que falhou
 *     ao sair não pode consumir a cota de quem nunca recebeu mensagem nenhuma.
 *
 *  3. **`drop table password_reset_tokens`** — o link por e-mail deixou de existir, e tabela morta
 *     apodrece: alguém a lê num incidente e conclui que há um segundo caminho de recuperação vivo.
 *     O que se perde são tokens em trânsito, com validade de uma hora. Quem estava no meio de um
 *     reset pede um código novo. O `down()` recria a tabela vazia.
 *
 * `attempts` não tem índice: só é lido junto da linha que já foi encontrada por `user_id`.
 */
export class Migration20260805090000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`alter table "users" add column "phone" varchar(20) null;`);

    this.addSql(`
      create table "password_reset_codes" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "user_id" uuid not null,
        "code_hash" varchar(100) not null,
        "expires_at" timestamptz not null,
        "used_at" timestamptz null,
        "sent_at" timestamptz null,
        "attempts" int not null default 0,
        "created_at" timestamptz not null default now(),
        constraint "password_reset_codes_pkey" primary key ("id"),
        constraint "password_reset_codes_attempts_check" check ("attempts" >= 0)
      );
    `);

    this.addSql(
      `create index "password_reset_codes_account_id_index" on "password_reset_codes" ("account_id");`,
    );

    // Índice do caminho quente: "o último código vivo deste usuário". Parcial em `used_at is null`
    // porque código usado nunca é consultado de novo — o índice fica pequeno para sempre.
    this.addSql(`
      create index "password_reset_codes_live_index"
        on "password_reset_codes" ("user_id", "created_at" desc)
        where "used_at" is null;
    `);

    // Base do limite por hora: conta envios de um usuário numa janela.
    this.addSql(`
      create index "password_reset_codes_sent_index"
        on "password_reset_codes" ("user_id", "sent_at")
        where "sent_at" is not null;
    `);

    this.addSql(`drop table if exists "password_reset_tokens";`);
  }

  async down(): Promise<void> {
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
        constraint "password_reset_tokens_token_hash_unique" unique ("token_hash")
      );
    `);
    this.addSql(
      `create index "password_reset_tokens_user_id_index" on "password_reset_tokens" ("user_id");`,
    );
    this.addSql(
      `create index "password_reset_tokens_account_id_index" on "password_reset_tokens" ("account_id");`,
    );

    this.addSql(`drop table if exists "password_reset_codes";`);
    this.addSql(`alter table "users" drop column "phone";`);
  }
}
