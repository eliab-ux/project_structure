import { ConfigService } from '@nestjs/config';
import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { TenantScopeSubscriber } from '../tenant-scope.subscriber';

/** A DATABASE_URL still holding a template value — dev can boot without a real database. */
function looksLikePlaceholder(clientUrl: string): boolean {
  return /CHANGE_ME|YOUR_PASSWORD|user:pass@/i.test(clientUrl);
}

/**
 * The APPLICATION's ORM config. Connects as `DATABASE_URL` — the RUNTIME role (`veertex_app`),
 * which has no DDL and is subject to RLS. Migrations use a different role and a different config
 * file (`mikro-orm.config.ts` at the package root); mixing the two is what silently disables
 * tenant isolation, because RLS does not apply to the owner of a table.
 */
export function createMikroOrmConfig(configService: ConfigService) {
  const clientUrl = configService.get<string>('DATABASE_URL');
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';

  if (!clientUrl) {
    throw new Error('DATABASE_URL is required. Set it in backend/.env');
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

  // In development with a placeholder URL, connect lazily so the app still boots (and /api/health
  // still answers) without a database. Production always connects eagerly.
  const connect = !(nodeEnv === 'development' && looksLikePlaceholder(clientUrl));

  return defineConfig({
    clientUrl,
    connect,
    extensions: [Migrator],
    // Self-hosted Postgres. Keep the API pool small and size max_connections as API + workers.
    pool: { min: 0, max: 5, idleTimeoutMillis: 10_000 },
    entities: ['./dist/**/*.entity.js'],
    entitiesTs: ['./src/**/*.entity.ts'],
    // The tenant → database bridge. Registered globally so no code path can opt out of it.
    subscribers: [new TenantScopeSubscriber()],
    migrations: {
      path: './dist/infrastructure/persistence/mikro-orm/migrations',
      pathTs: './src/infrastructure/persistence/mikro-orm/migrations',
      // Schema changes only ever ship as a versioned migration — never schema:update in production.
      transactional: true,
      disableForeignKeys: false,
    },
    // Timestamps are stored/read in UTC; per-account timezone lives in `accounts.timezone`.
    forceUtcTimezone: true,
  });
}
