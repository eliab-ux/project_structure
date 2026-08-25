import { ConfigService } from '@nestjs/config';
import { defineConfig } from '@mikro-orm/mysql';

/**
 * EMDR Remoto mantém MySQL/MariaDB (sem migração de SGBD) — só troca o ORM para MikroORM.
 * Ports, repositórios e mappers permanecem idênticos ao padrão do CLAUDE.md.
 */
export function createMikroOrmConfig(configService: ConfigService) {
  const clientUrl = configService.get<string>('DATABASE_URL');
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';

  if (!clientUrl) {
    throw new Error('DATABASE_URL is required. Set it in apps/emdrremoto/backend/.env');
  }

  try {
    // eslint-disable-next-line no-new
    new URL(clientUrl);
  } catch {
    throw new Error('Invalid DATABASE_URL (expected mysql://user:pass@host:3306/db).');
  }

  // In dev without a real DB, connect lazily so the app can still boot (Fail Securely).
  const looksLikePlaceholder = clientUrl.includes('YOUR_') || clientUrl.includes('<');
  const connect = !(nodeEnv === 'development' && looksLikePlaceholder);

  return defineConfig({
    clientUrl,
    connect,
    // Pool pequeno para operar bem atrás de poolers/limites do provedor (playbook Dokploy).
    pool: { min: 0, max: 5, idleTimeoutMillis: 10_000 },
    entities: ['./dist/**/*.entity.js'],
    entitiesTs: ['./src/**/*.entity.ts'],
    migrations: {
      path: './dist/infrastructure/persistence/mikro-orm/migrations',
      pathTs: './src/infrastructure/persistence/mikro-orm/migrations',
    },
    seeder: {
      path: './dist/infrastructure/persistence/mikro-orm/seeders',
      pathTs: './src/infrastructure/persistence/mikro-orm/seeders',
      defaultSeeder: 'DatabaseSeeder',
      glob: '!(*.d).{js,ts}',
      emit: 'ts',
    },
  });
}
