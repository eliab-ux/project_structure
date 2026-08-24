import { Migration } from '@mikro-orm/migrations';

/**
 * Bloqueio por inadimplência (06 §2.5): preferências da conta — LIGADO por default com N=30 dias
 * (o desenho do 06 pede bloqueio por default; a exceção é a permissão granular
 * `orders.overdue.override`). Aditiva com default — contas existentes ganham o comportamento
 * padrão sem intervenção.
 */
export class Migration20260824040000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "accounts"
        add column if not exists "overdue_block_enabled" boolean not null default true,
        add column if not exists "overdue_block_days" int not null default 30;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`alter table "accounts" drop column if exists "overdue_block_days";`);
    this.addSql(`alter table "accounts" drop column if exists "overdue_block_enabled";`);
  }
}
