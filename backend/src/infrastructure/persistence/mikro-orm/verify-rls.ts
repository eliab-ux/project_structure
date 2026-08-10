import { loadEnvFiles } from '../../../config/load-env';
import { Client } from 'pg';
import { DEFAULT_ISOLATION_ROLES, verifyIsolationInvariants } from '../isolation-invariants';
import {
  AppSession,
  createRlsFixtures,
  dropRlsFixtures,
  runRlsBehaviorChecks,
} from '../rls-behavior-checks';

// Sem .env no container (o Dokploy injeta o ambiente); a chamada é inofensiva quando o arquivo não
// existe e necessária quando existe, no uso local.
loadEnvFiles();

/**
 * `npm run verify:rls:prod` — o critério de aceite §7.2, executável dentro do container.
 *
 * Conecta com AS DUAS credenciais: a de owner para montar e derrubar as fixtures, e a de RUNTIME
 * para fazer as asserções. Rodar tudo como owner não provaria nada — o dono não é afetado pelas
 * policies, e o suite ficaria verde com o isolamento desligado.
 *
 * Antes das asserções de comportamento, roda os invariantes de CONFIGURAÇÃO e aborta se algum
 * falhar. A ordem importa: num banco mal provisionado, "zero linhas sem escopo" pode ser verdade
 * por acaso — porque a tabela está vazia, porque o grant não existe — e passaria como prova de algo
 * que não foi verificado.
 *
 * Deixa o banco como encontrou: as fixtures são removidas no `finally`, e cada asserção roda dentro
 * de uma transação com rollback. Pode rodar num banco com dado real.
 */
async function run(): Promise<void> {
  const ownerUrl = process.env.DATABASE_URL_MIGRATIONS;
  const appUrl = process.env.DATABASE_URL;

  if (!ownerUrl || !appUrl) {
    throw new Error(
      'DATABASE_URL (runtime) e DATABASE_URL_MIGRATIONS (owner) são obrigatórias: a verificação ' +
        'precisa das duas credenciais para ter validade.',
    );
  }

  const roles = {
    owner: process.env.DATABASE_OWNER_ROLE ?? DEFAULT_ISOLATION_ROLES.owner,
    app: process.env.DATABASE_APP_ROLE ?? DEFAULT_ISOLATION_ROLES.app,
  };

  const owner = new Client({ connectionString: ownerUrl });
  const app = new Client({ connectionString: appUrl });

  await owner.connect();
  await app.connect();

  const ownerQuery = async (sql: string, params?: unknown[]) =>
    (await owner.query(sql, params as unknown[])).rows;

  const session: AppSession = {
    query: async (sql, params) => (await app.query(sql, params as unknown[])).rows,
    begin: async () => void (await app.query('begin')),
    commit: async () => void (await app.query('commit')),
    rollback: async () => void (await app.query('rollback')),
  };

  let fixtures: Awaited<ReturnType<typeof createRlsFixtures>> | null = null;

  try {
    // ── 1. Configuração ────────────────────────────────────────────────────────────────────
    const violations = await verifyIsolationInvariants(ownerQuery, roles);
    if (violations.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        '\n❌ Banco mal provisionado — as asserções de comportamento não teriam valor:\n',
      );
      for (const violation of violations) {
        // eslint-disable-next-line no-console
        console.error(`   [${violation.check}] ${violation.detail}`);
      }
      process.exitCode = 1;
      return;
    }
    // eslint-disable-next-line no-console
    console.log('✅ Invariantes de configuração: OK');

    // ── 2. Comportamento ───────────────────────────────────────────────────────────────────
    fixtures = await createRlsFixtures(ownerQuery);
    const results = await runRlsBehaviorChecks(session, fixtures);

    const failed = results.filter((result) => !result.passed);

    for (const result of results) {
      // eslint-disable-next-line no-console
      console.log(
        result.passed
          ? `   ✅ ${result.name}`
          : `   ❌ ${result.name}\n        ${result.detail ?? ''}`,
      );
    }

    if (failed.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `\n❌ ${failed.length} de ${results.length} asserção(ões) de isolamento falharam. ` +
          'O isolamento entre contas NÃO está garantido.\n',
      );
      process.exitCode = 1;
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`\n✅ §7.2 satisfeito: ${results.length} asserções, todas passando.\n`);
  } finally {
    if (fixtures) {
      await dropRlsFixtures(ownerQuery, fixtures).catch((error) => {
        // Falhar na limpeza não invalida o resultado, mas deixa lixo — precisa aparecer.
        // eslint-disable-next-line no-console
        console.error(`⚠️  Falha ao remover as fixtures: ${(error as Error)?.message}`);
      });
    }
    await app.end().catch(() => undefined);
    await owner.end().catch(() => undefined);
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`❌ ${(error as Error)?.message ?? error}`);
  process.exit(1);
});
