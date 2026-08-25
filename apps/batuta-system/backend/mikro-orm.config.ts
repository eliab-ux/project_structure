/**
 * CLI-only config (`npm run migration:create|up|down`). The application itself builds its
 * config from ConfigService in `src/infrastructure/persistence/mikro-orm/config/`.
 *
 * The `.env` load has to happen HERE and not be assumed: the CLI is a bare Node process with no
 * NestJS ConfigModule, so without this line `DATABASE_URL` is undefined and every migration command
 * fails with "DATABASE_URL is required" while the application itself connects fine — a confusing
 * pair of symptoms. `override: false` keeps a value exported in the shell (or injected by Dokploy)
 * winning over the file, which is what a deploy needs.
 */
import { config as loadEnv } from 'dotenv';
import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';

loadEnv({ override: false });

const clientUrl = process.env.DATABASE_URL;
if (!clientUrl) {
  throw new Error('DATABASE_URL is required to run migrations (set it in .env).');
}

export default defineConfig({
  clientUrl,
  connect: true,
  extensions: [Migrator],
  pool: { min: 0, max: 5 },
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
  discovery: { warnWhenNoEntities: false },
  migrations: {
    path: './dist/infrastructure/persistence/mikro-orm/migrations',
    pathTs: './src/infrastructure/persistence/mikro-orm/migrations',
  },
  forceUtcTimezone: true,
});
