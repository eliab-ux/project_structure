import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { randomBytes } from 'crypto';
import { MarketplaceApiKeyOrmEntity } from '../entities/marketplace-api-key-orm.entity';

export class MarketplaceApiKeySeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const existing = await em.count(MarketplaceApiKeyOrmEntity);
    if (existing > 0) {
      console.log('⚠️ Marketplace API key already exists, skipping seed.');
      return;
    }

    const apiKey = em.create(MarketplaceApiKeyOrmEntity, {
      name: 'Magis5 ERP',
      apiKey: randomBytes(32).toString('hex'),
      apiSecret: randomBytes(32).toString('hex'),
      isActive: true,
      permissions: ['products:read', 'products:write', 'orders:read'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await em.persistAndFlush(apiKey);

    console.log('='.repeat(80));
    console.log('MARKETPLACE API CREDENTIALS GENERATED');
    console.log('='.repeat(80));
    console.log(`API Key:    ${apiKey.apiKey}`);
    console.log(`API Secret: ${apiKey.apiSecret}`);
    console.log('='.repeat(80));
    console.log('SAVE THESE CREDENTIALS SECURELY - THEY WILL NOT BE SHOWN AGAIN');
    console.log('='.repeat(80));
  }
}
