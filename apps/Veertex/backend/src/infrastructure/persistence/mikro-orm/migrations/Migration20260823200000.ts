import { Migration } from '@mikro-orm/migrations';

/**
 * Condição de pagamento no pedido (§3.6 do 02): o pedido carrega condição PRÓPRIA, herdada do
 * default do contato na criação e editável enquanto rascunho. Duas colunas, ambas nullable —
 * condição é opcional por natureza (venda à vista sem condição cadastrada continua válida).
 */
export class Migration20260823200000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "contacts"
        add column if not exists "default_payment_condition_id" uuid null;
    `);
    this.addSql(`
      alter table "orders"
        add column if not exists "payment_condition_id" uuid null;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`alter table "orders" drop column if exists "payment_condition_id";`);
    this.addSql(`alter table "contacts" drop column if exists "default_payment_condition_id";`);
  }
}
