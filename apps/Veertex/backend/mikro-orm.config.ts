/**
 * CLI-only config (`npm run migration:create|up|down`). The application itself builds its config
 * from ConfigService in `src/infrastructure/persistence/mikro-orm/config/`.
 *
 * The `.env` load has to happen HERE and not be assumed: the CLI is a bare Node process with no
 * NestJS ConfigModule, so without this line the connection string is undefined and every migration
 * command fails while the application itself connects fine — a confusing pair of symptoms.
 * `override: false` keeps a value exported in the shell (or injected by Dokploy) winning over the
 * file, which is what a deploy needs.
 *
 * ⚠️ This connects as `DATABASE_URL_MIGRATIONS` — the OWNER role (`veertex_owner`), not the runtime
 * role. Two reasons, both structural:
 *   1. the runtime role has no DDL, so it cannot create a table even if asked;
 *   2. RLS does not apply to the table owner, so the migration can backfill and verify rows across
 *      tenants — which is exactly the power the runtime role must never have.
 * See `deploy/sql/001_create_roles.sql`.
 */
import { config as loadEnv } from 'dotenv';
import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';

loadEnv({ override: false });

const clientUrl = process.env.DATABASE_URL_MIGRATIONS ?? process.env.DATABASE_URL;
if (!clientUrl) {
  throw new Error(
    'DATABASE_URL_MIGRATIONS é obrigatória para rodar migrations (defina no .env — ver .env.example). ' +
      'Ela deve apontar para o usuário OWNER do banco, não para o usuário de runtime.',
  );
}

if (!process.env.DATABASE_URL_MIGRATIONS) {
  // Not fatal in development (one-role local setups are common), but it must be loud: running
  // migrations as the runtime role silently produces tables owned by the wrong role, and then RLS
  // stops applying to the application — the failure is invisible until a tenant reads another's data.
  // eslint-disable-next-line no-console
  console.warn(
    '⚠️  DATABASE_URL_MIGRATIONS ausente: usando DATABASE_URL. Em produção isso é um erro — ' +
      'as tabelas ficariam com o dono errado e o RLS deixaria de valer para a aplicação.',
  );
}

export default defineConfig({
  clientUrl,
  connect: true,
  extensions: [Migrator],
  pool: { min: 0, max: 2 },
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
  discovery: { warnWhenNoEntities: false },
  migrations: {
    path: './dist/infrastructure/persistence/mikro-orm/migrations',
    pathTs: './src/infrastructure/persistence/mikro-orm/migrations',
    transactional: true,
    disableForeignKeys: false,
  },
  forceUtcTimezone: true,
});
