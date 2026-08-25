import { ConfigService } from '@nestjs/config';
import { defineConfig } from '@mikro-orm/postgresql';

export function createMikroOrmConfig(configService: ConfigService) {
  const clientUrl = configService.get<string>('DATABASE_URL');
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';

  if (!clientUrl) {
    throw new Error('DATABASE_URL is required. Set it in apps/ecoa-system/backend/.env');
  }

  try {
    // eslint-disable-next-line no-new
    new URL(clientUrl);
  } catch {
    const hint =
      clientUrl.includes('PROJECT_REF') || clientUrl.includes('YOUR_')
        ? ' It looks like you are still using a placeholder value.'
        : '';
    throw new Error(`Invalid DATABASE_URL.${hint}`);
  }

  const looksLikePlaceholder =
    clientUrl.includes('YOUR_PASSWORD') || clientUrl.includes('PROJECT_REF');

  // In dev with placeholders, connect lazily so the app can boot without a real DB.
  const connect = !(nodeEnv === 'development' && looksLikePlaceholder);

  return defineConfig({
    dbName: 'postgres',
    clientUrl,
    connect,
    // Supabase Session Pooler caps simultaneous clients at pool_size (default 15) and each
    // session-mode client holds a server connection for its whole lifetime. Keep our pool
    // small so we never hit "(EMAXCONNSESSION) max clients reached in session mode".
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
