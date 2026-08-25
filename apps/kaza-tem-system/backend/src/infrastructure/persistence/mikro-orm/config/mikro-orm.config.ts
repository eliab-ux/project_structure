import { ConfigService } from '@nestjs/config';
import { defineConfig } from '@mikro-orm/postgresql';

export function createMikroOrmConfig(configService: ConfigService) {
  const clientUrl = configService.get<string>('DATABASE_URL');
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';

  if (!clientUrl) {
    throw new Error('DATABASE_URL is required. Set it in apps/kaza-tem-system/backend/.env');
  }

  // Fail fast with a helpful message instead of a generic "Invalid URL" from Node.
  try {
    // eslint-disable-next-line no-new
    new URL(clientUrl);
  } catch {
    const hint =
      clientUrl.includes('[') || clientUrl.includes('YOUR_')
        ? ' It looks like you are still using a placeholder value.'
        : '';
    throw new Error(`Invalid DATABASE_URL.${hint}`);
  }

  const looksLikePlaceholder =
    clientUrl.includes('YOUR_PASSWORD') ||
    clientUrl.includes('PROJECT_REF') ||
    clientUrl.includes('[YOUR-') ||
    clientUrl.includes('YOUR-PROJECT-REF');

  // When using placeholders in development, avoid crashing the whole app on startup.
  // MikroORM will establish the connection lazily when first used.
  const connect = !(nodeEnv === 'development' && looksLikePlaceholder);

  return defineConfig({
    dbName: 'postgres',
    clientUrl,
    connect,
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
