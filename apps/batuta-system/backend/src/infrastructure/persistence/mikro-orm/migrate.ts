import { ConfigService } from '@nestjs/config';
import { MikroORM } from '@mikro-orm/postgresql';
import { createMikroOrmConfig } from './config/mikro-orm.config';

/**
 * Applies pending migrations from COMPILED code.
 *
 * This exists for deploy. The CLI (`npm run migration:up`) reads `mikro-orm.config.ts` through ts-node,
 * which means a production image would need TypeScript, the dev dependencies, and the config file copied
 * into the runtime layer — three things whose only purpose would be to run one command. Worse, it would
 * make production depend on a toolchain that the running application does not use.
 *
 * So the deploy runs `node dist/infrastructure/persistence/mikro-orm/migrate.js`, which reuses the very
 * config the application boots with. There is exactly one description of how to reach this database.
 *
 * It exits non-zero on failure, deliberately: a deploy that could not migrate must fail loudly and stop,
 * not start an API against a schema that does not match the code.
 */
async function run(): Promise<void> {
  // A bare ConfigService over process.env: in a container the environment IS the configuration, and
  // reading a .env file here would silently prefer a file that should not exist in the image.
  const config = new ConfigService(process.env);
  const orm = await MikroORM.init({ ...createMikroOrmConfig(config), connect: true });

  try {
    const migrator = orm.getMigrator();
    const pending = await migrator.getPendingMigrations();

    if (pending.length === 0) {
      process.stdout.write('Nenhuma migration pendente.\n');
      return;
    }

    process.stdout.write(`Aplicando ${pending.length} migration(s):\n`);
    for (const migration of pending) {
      process.stdout.write(`  · ${migration.name}\n`);
    }

    await migrator.up();
    process.stdout.write('Migrations aplicadas.\n');
  } finally {
    await orm.close(true);
  }
}

run().catch((error: Error) => {
  process.stderr.write(`Falha ao aplicar migrations: ${error.message}\n`);
  process.exit(1);
});
