import { Migration } from '@mikro-orm/migrations';

/**
 * Comissão — atributo `commission_model` no cadastro do usuário (§2 do 02A). Dormente: nasce agora
 * (schema pronto, migration barata) mas só a apuração sob demanda o usa; o gatilho automático espera
 * o faturamento/acerto. Coluna adicionada a uma tabela que já tem linhas → entra com default `none`
 * (NOT NULL sustentado pelo default), sem backfill nulo transitório.
 */
export class Migration20260822240000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "users"
        add column if not exists "commission_model" varchar(10) not null default 'none';
    `);
    this.addSql(`
      alter table "users"
        add constraint "users_commission_model_check" check ("commission_model" in ('none','a','b'));
    `);
  }

  async down(): Promise<void> {
    this.addSql(`alter table "users" drop constraint if exists "users_commission_model_check";`);
    this.addSql(`alter table "users" drop column if exists "commission_model";`);
  }
}
