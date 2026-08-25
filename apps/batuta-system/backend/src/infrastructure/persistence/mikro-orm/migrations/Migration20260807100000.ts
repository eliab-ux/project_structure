import { Migration } from '@mikro-orm/migrations';

/**
 * `contents.include_source_url` — o link de origem passa a poder ir na mensagem.
 *
 * Até aqui `source_url` era só procedência: metadado para o aprovador conferir a mensagem contra o
 * post original, invisível para o contato e deliberadamente FORA do `content_hash`, para que corrigir
 * um link errado não custasse uma aprovação.
 *
 * Com esta coluna ligada o link vira texto que o contato recebe — e aí ele entra no hash junto com a
 * flag. Sem isso, alguém trocaria o link depois da aprovação sem invalidar nada: o aprovador teria
 * assinado um destino e a base receberia outro.
 *
 * `default false` e `not null`: as linhas que já existem continuam exatamente como estavam, com o
 * link como procedência. Nenhum conteúdo aprovado passa a enviar um link que ninguém aprovou — e,
 * como o hash gravado não é recalculado na leitura, nenhuma aprovação existente é invalidada por
 * esta migration.
 */
export class Migration20260807100000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "contents"
        add column if not exists "include_source_url" boolean not null default false;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`alter table "contents" drop column if exists "include_source_url";`);
  }
}
