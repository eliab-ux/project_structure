import { Migration } from '@mikro-orm/migrations';

export class Migration20260317190000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE marketplace_api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        api_key VARCHAR(64) UNIQUE NOT NULL,
        api_secret VARCHAR(64) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        permissions JSONB DEFAULT '["products:read", "products:write", "orders:read"]',
        webhook_url VARCHAR(500),
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_marketplace_api_keys_key ON marketplace_api_keys(api_key);
    `);
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS marketplace_api_keys CASCADE;');
  }
}
