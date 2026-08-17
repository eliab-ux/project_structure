import { Migration } from '@mikro-orm/migrations';

/**
 * Baseline. Nenhuma tabela de negócio ainda — `account`, `machine` e `user` chegam na migration
 * seguinte.
 *
 * Existe para a cadeia de migrations começar aqui (e `mikro_orm_migrations` ser criada num banco
 * novo) e para habilitar as duas extensões de que todo o resto depende:
 *
 * - `pgcrypto` → `gen_random_uuid()`, o default de toda PK uuid a partir da Fase 1. Só é embutido
 *   no Postgres a partir da 13, e o alvo é a 17, mas declarar é o que torna a migration
 *   reproduzível em qualquer instalação.
 * - `btree_gist` → exigida pela constraint EXCLUDE que impede duas `machine_hour` sobrepostas na
 *   mesma máquina (spec §4.8, Fase 4). Ela entra aqui, e não lá, porque é o DoD da Fase 1 que a
 *   pede: extensão é privilégio de superusuário, e descobrir isso no meio da Fase 4 significaria
 *   travar a entrega esperando acesso ao banco.
 *
 * Idempotente por construção: seguro re-rodar num banco existente.
 */
export class Migration20260814120000 extends Migration {
  async up(): Promise<void> {
    this.addSql('create extension if not exists "pgcrypto";');
    this.addSql('create extension if not exists "btree_gist";');
  }

  async down(): Promise<void> {
    // As extensões NÃO são derrubadas de propósito: outros objetos já podem depender delas, e
    // removê-las seria destrutivo sem ser reversível em nenhum sentido útil.
  }
}
