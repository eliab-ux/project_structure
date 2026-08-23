import { Migration } from '@mikro-orm/migrations';

/**
 * `client_uuid` nas mutações de PROPOSTA do campo (proposta do app aprovada em 23/08/2026,
 * antecipada na Leva 2): idempotência do sync — reenvio da outbox após queda de rede encontra o
 * registro em vez de duplicá-lo. Único POR CONTA quando presente (índice parcial); nulo para tudo
 * que a retaguarda cria. Aditiva.
 */
export class Migration20260824010000 extends Migration {
  async up(): Promise<void> {
    for (const table of ['orders', 'field_receipts', 'order_evidences', 'trip_expenses']) {
      this.addSql(`alter table "${table}" add column if not exists "client_uuid" uuid null;`);
      this.addSql(`
        create unique index if not exists "${table}_account_client_uuid_uq"
          on "${table}" ("account_id", "client_uuid")
          where "client_uuid" is not null;
      `);
    }
  }

  async down(): Promise<void> {
    for (const table of ['orders', 'field_receipts', 'order_evidences', 'trip_expenses']) {
      this.addSql(`drop index if exists "${table}_account_client_uuid_uq";`);
      this.addSql(`alter table "${table}" drop column if exists "client_uuid";`);
    }
  }
}
