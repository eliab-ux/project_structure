import { ConfigService } from '@nestjs/config';
import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';

/** A DATABASE_URL still holding a template value — dev can boot without a real database. */
function looksLikePlaceholder(clientUrl: string): boolean {
  return /YOUR_PASSWORD|CHANGE_ME|user:pass@/i.test(clientUrl);
}

export function createMikroOrmConfig(configService: ConfigService) {
  const clientUrl = configService.get<string>('DATABASE_URL');
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';

  if (!clientUrl) {
    throw new Error('DATABASE_URL is required. Set it in apps/batuta-system/backend/.env');
  }

  try {
    // eslint-disable-next-line no-new
    new URL(clientUrl);
  } catch {
    throw new Error(
      `Invalid DATABASE_URL.${
        looksLikePlaceholder(clientUrl) ? ' It looks like you are still using a placeholder.' : ''
      }`,
    );
  }

  // In development with a placeholder URL, connect lazily so the app still boots (and
  // /api/health still answers) without a database. Production always connects eagerly.
  const connect = !(nodeEnv === 'development' && looksLikePlaceholder(clientUrl));

  return defineConfig({
    clientUrl,
    connect,
    extensions: [Migrator],
    // Self-hosted Postgres shared with concurrent BullMQ workers: keep the API pool small and
    // size max_connections as API + workers (BATUTA_SPEC §0 / §11).
    pool: { min: 0, max: 5, idleTimeoutMillis: 10_000 },
    entities: ['./dist/**/*.entity.js'],
    entitiesTs: ['./src/**/*.entity.ts'],
    migrations: {
      path: './dist/infrastructure/persistence/mikro-orm/migrations',
      pathTs: './src/infrastructure/persistence/mikro-orm/migrations',
      // Schema changes only ever ship as a versioned migration — never schema:update /
      // create_all in production (BATUTA_SPEC §5, FASE 0 item 4).
      disableForeignKeys: false,
      transactional: true,
    },
    // Timestamps are stored/read in UTC; per-account timezone lives in `accounts.timezone`.
    forceUtcTimezone: true,
  });
}
