import { Migration } from '@mikro-orm/migrations';

/**
 * commission_due_rule (registro de 23/08/2026): vencimento das comissões materializadas como conta
 * a pagar. Default = comportamento original (último dia do período), sem breaking; 'day_n_next_month'
 * usa o dia N (1-28) do mês seguinte. Aditiva, com default — contas existentes não mudam.
 */
export class Migration20260823230000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "accounts"
        add column if not exists "commission_due_rule" varchar(30) not null default 'last_day_of_period',
        add column if not exists "commission_due_day" int not null default 5;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`alter table "accounts" drop column if exists "commission_due_day";`);
    this.addSql(`alter table "accounts" drop column if exists "commission_due_rule";`);
  }
}
