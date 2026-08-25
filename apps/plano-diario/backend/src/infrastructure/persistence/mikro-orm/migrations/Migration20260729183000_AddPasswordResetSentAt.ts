import { Migration } from '@mikro-orm/migrations';

export class Migration20260729183000_AddPasswordResetSentAt extends Migration {
  override async up(): Promise<void> {
    // O limite de solicitações por hora passa a contar ENVIOS, não tentativas: mensagem que não
    // saiu não spammou ninguém e não deve gastar a cota do usuário.
    //
    // As linhas que já existem ficam com `sent_at` nulo — o que é a verdade sobre elas: foram
    // criadas enquanto o canal estava sem configuração e nenhuma mensagem chegou a sair. Como
    // nulo não conta, elas deixam de bloquear a próxima solicitação.
    this.addSql(`alter table "password_reset_codes" add column "sent_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "password_reset_codes" drop column if exists "sent_at";`);
  }
}
