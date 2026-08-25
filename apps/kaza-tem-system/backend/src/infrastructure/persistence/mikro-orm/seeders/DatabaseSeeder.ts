import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { MarketplaceApiKeySeeder } from './MarketplaceApiKeySeeder';
import { UserSeeder } from './UserSeeder';

export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    console.log('🌱 Iniciando seed do banco de dados...');
    console.log('');

    await this.call(em, [MarketplaceApiKeySeeder, UserSeeder]);

    console.log('');
    console.log('✅ Seed concluído com sucesso!');
  }
}
