import { Migration } from '@mikro-orm/migrations';

export class Migration20260318123000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_bling_id_unique";
      ALTER TABLE "products" DROP COLUMN IF EXISTS "bling_id";
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "bling_id" VARCHAR(50) NOT NULL DEFAULT '';
      ALTER TABLE "products" ADD CONSTRAINT IF NOT EXISTS "products_bling_id_unique" UNIQUE ("bling_id");
    `);
  }
}
