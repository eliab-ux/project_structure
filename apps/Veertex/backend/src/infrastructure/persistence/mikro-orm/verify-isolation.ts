import { loadEnvFiles } from '../../../config/load-env';
import { Client } from 'pg';
import { DEFAULT_ISOLATION_ROLES, verifyIsolationInvariants } from '../isolation-invariants';

loadEnvFiles();

/**
 * `npm run verify:isolation` — checks that the database still satisfies the assumptions the F1
 * isolation design rests on. Exits non-zero on any violation, so it can gate a deploy.
 *
 * Run it after EVERY migration and after any manual change to roles or grants. The design uses
 * `ENABLE ROW LEVEL SECURITY` and not `FORCE`, which is safe only while the application connects as
 * a role that cannot bypass the policies — and that is a property of the database, not of the code.
 * Nothing in a build or a typecheck would ever notice it breaking.
 *
 * Connects as the OWNER: reading `pg_class`, `pg_proc` and the grant catalogue needs to see the
 * whole schema, and the runtime role deliberately cannot.
 */
async function run(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_MIGRATIONS ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL_MIGRATIONS é obrigatória para verificar o isolamento.');
  }

  const roles = {
    owner: process.env.DATABASE_OWNER_ROLE ?? DEFAULT_ISOLATION_ROLES.owner,
    app: process.env.DATABASE_APP_ROLE ?? DEFAULT_ISOLATION_ROLES.app,
  };

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const violations = await verifyIsolationInvariants(
      async (sql, params) => (await client.query(sql, params as unknown[])).rows,
      roles,
    );

    if (violations.length === 0) {
      // eslint-disable-next-line no-console
      console.log(
        `✅ Isolamento íntegro: tabelas pertencem a "${roles.owner}", "${roles.app}" está sujeito ao RLS,\n` +
          '   toda tabela com account_id tem policy, e a função de autenticação está com search_path fixo.',
      );
      return;
    }

    // eslint-disable-next-line no-console
    console.error(`\n❌ ${violations.length} violação(ões) de isolamento:\n`);
    for (const violation of violations) {
      // eslint-disable-next-line no-console
      console.error(`   [${violation.check}] ${violation.detail}`);
    }
    // eslint-disable-next-line no-console
    console.error(
      '\n   Enquanto isso não for corrigido, o isolamento entre contas NÃO está garantido.\n',
    );
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`❌ ${(error as Error)?.message ?? error}`);
  process.exit(1);
});
