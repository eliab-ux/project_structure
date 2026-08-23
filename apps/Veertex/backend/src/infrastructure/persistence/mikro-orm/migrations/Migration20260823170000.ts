import { Migration } from '@mikro-orm/migrations';

/**
 * ROT acabamento do acerto (decisões do Eliab, 23/08/2026):
 *  - `routes.cycle_days` (default 60): a "próxima passagem" — vencimento do título consignado que
 *    agora NASCE na efetivação do pedido (saída da viagem + ciclo);
 *  - colunas `closure_*` em `trips`: os inputs manuais do fechamento (gerente/ajudante) e a % da
 *    faixa aplicada PERSISTEM — o batimento é reproduzível dos dados gravados (condição da nota 5).
 * Migration ADITIVA; colunas em tabelas com linhas entram com default/nullable.
 */
export class Migration20260823170000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "routes"
        add column if not exists "cycle_days" int not null default 60;
    `);
    this.addSql(`
      alter table "trips"
        add column if not exists "closure_manager_user_id" uuid null,
        add column if not exists "closure_manager_percent" numeric(6,2) null,
        add column if not exists "closure_helper_amount" numeric(14,2) null,
        add column if not exists "closure_commission_percent" numeric(6,2) null,
        add column if not exists "closure_rep_commission" numeric(14,2) null;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`alter table "trips" drop column if exists "closure_rep_commission";`);
    this.addSql(`alter table "trips" drop column if exists "closure_commission_percent";`);
    this.addSql(`alter table "trips" drop column if exists "closure_helper_amount";`);
    this.addSql(`alter table "trips" drop column if exists "closure_manager_percent";`);
    this.addSql(`alter table "trips" drop column if exists "closure_manager_user_id";`);
    this.addSql(`alter table "routes" drop column if exists "cycle_days";`);
  }
}
