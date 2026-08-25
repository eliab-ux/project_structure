import { Migration } from '@mikro-orm/migrations';

/**
 * Baseline migration (FASE 0). No business table yet — `accounts`, `users` and
 * `platform_admins` arrive with FASE 1.
 *
 * It exists so the migration chain starts here and `mikro_orm_migrations` is created on a
 * fresh database, and it enables `pgcrypto` so `gen_random_uuid()` is available for the uuid
 * primary keys of every table from FASE 1 on (built in only from Postgres 13+).
 *
 * Idempotent by design: safe to re-run on an existing database.
 */
export class Migration20260803120000 extends Migration {
  async up(): Promise<void> {
    this.addSql('create extension if not exists "pgcrypto";');
  }

  async down(): Promise<void> {
    // The extension is intentionally NOT dropped: other objects may already depend on it,
    // and dropping it would be destructive without being reversible in any useful sense.
  }
}
