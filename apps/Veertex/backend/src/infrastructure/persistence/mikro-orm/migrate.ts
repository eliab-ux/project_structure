import { config as loadEnv } from 'dotenv';
import { MikroORM } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';

loadEnv({ override: false });

/**
 * Runs pending migrations once, then exits. Called by the deploy (`npm run migrate:prod`) BEFORE
 * the service starts.
 *
 * Migrations deliberately do NOT run when the container boots: with two replicas, two processes
 * would apply the same batch simultaneously.
 *
 * Connects as the OWNER role. The runtime role has no DDL — by design — so running this with
 * `DATABASE_URL` would fail on the first `create table`, and succeeding would be worse: tables
 * owned by the runtime role are tables RLS no longer applies to.
 */
async function run(): Promise<void> {
  const clientUrl = process.env.DATABASE_URL_MIGRATIONS ?? process.env.DATABASE_URL;
  if (!clientUrl) {
    throw new Error('DATABASE_URL_MIGRATIONS é obrigatória para aplicar migrations.');
  }

  const orm = await MikroORM.init(
    defineConfig({
      clientUrl,
      extensions: [Migrator],
      pool: { min: 0, max: 2 },
      entities: ['./dist/**/*.entity.js'],
      entitiesTs: ['./src/**/*.entity.ts'],
      discovery: { warnWhenNoEntities: false },
      migrations: {
        path: './dist/infrastructure/persistence/mikro-orm/migrations',
        pathTs: './src/infrastructure/persistence/mikro-orm/migrations',
        transactional: true,
      },
      forceUtcTimezone: true,
    }),
  );

  try {
    const applied = await orm.getMigrator().up();
    // eslint-disable-next-line no-console
    console.log(
      applied.length === 0
        ? '✅ Nenhuma migration pendente.'
        : `✅ ${applied.length} migration(s) aplicada(s): ${applied.map((m) => m.name).join(', ')}`,
    );
  } finally {
    await orm.close(true);
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('❌ Falha ao aplicar migrations:', error);
  process.exit(1);
});
