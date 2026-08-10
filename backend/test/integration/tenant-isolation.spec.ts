import { Client } from 'pg';
import {
  DEFAULT_ISOLATION_ROLES,
  verifyIsolationInvariants,
} from '../../src/infrastructure/persistence/isolation-invariants';
import {
  AppSession,
  RlsCheckResult,
  RlsFixtures,
  createRlsFixtures,
  dropRlsFixtures,
  runRlsBehaviorChecks,
} from '../../src/infrastructure/persistence/rls-behavior-checks';

/**
 * Critério de aceite §7.2 — "RLS ativo: query sem contexto de conta não retorna dados".
 *
 * As asserções em si vivem em `rls-behavior-checks.ts`, compartilhadas com o CLI
 * `verify:rls:prod`. O motivo é operacional e importa: a imagem de runtime não carrega `test/` nem
 * o jest, e a verificação precisa rodar DENTRO do container — é lá que o banco é alcançável. Ter as
 * asserções em dois lugares significaria corrigir uma e esquecer a outra, e a esquecida é sempre a
 * que roda em produção.
 *
 * Este arquivo é, então, o invólucro de desenvolvimento: conecta, delega, e reporta cada asserção
 * como um `it` para o jest dar diagnóstico item a item.
 *
 * Roda como `veertex_app`, o papel de RUNTIME. Como o dono não é afetado pelas policies, rodar como
 * ele deixaria tudo verde com o isolamento desligado.
 */

const OWNER_URL = process.env.DATABASE_URL_MIGRATIONS;
const APP_URL = process.env.DATABASE_URL;
const SKIP = process.env.VEERTEX_SKIP_DB_TESTS === 'true';

describe('Isolamento entre contas (RLS) — §7.2', () => {
  let owner: Client;
  let app: Client;
  let fixtures: RlsFixtures;
  let results: RlsCheckResult[] = [];

  beforeAll(async () => {
    if (SKIP) {
      return;
    }
    if (!OWNER_URL || !APP_URL) {
      // Falha, não pula. Um teste de segurança que se auto-desativa quando o ambiente não está
      // configurado é um teste que um dia some do CI sem ninguém notar.
      throw new Error(
        'DATABASE_URL e DATABASE_URL_MIGRATIONS são necessárias para o teste de isolamento. ' +
          'Para pular conscientemente, defina VEERTEX_SKIP_DB_TESTS=true.',
      );
    }

    owner = new Client({ connectionString: OWNER_URL });
    app = new Client({ connectionString: APP_URL });
    await owner.connect();
    await app.connect();

    const ownerQuery = async (sql: string, params?: unknown[]) =>
      (await owner.query(sql, params as unknown[])).rows;

    // Pré-condição: num banco mal provisionado, "zero linhas sem escopo" pode ser verdade por acaso
    // — tabela vazia, grant ausente — e passaria como prova de algo que não foi verificado.
    const violations = await verifyIsolationInvariants(ownerQuery, DEFAULT_ISOLATION_ROLES);
    if (violations.length > 0) {
      throw new Error(
        'Banco mal provisionado — o teste de isolamento não tem validade:\n' +
          violations.map((v) => `  [${v.check}] ${v.detail}`).join('\n'),
      );
    }

    const session: AppSession = {
      query: async (sql, params) => (await app.query(sql, params as unknown[])).rows,
      begin: async () => void (await app.query('begin')),
      commit: async () => void (await app.query('commit')),
      rollback: async () => void (await app.query('rollback')),
    };

    fixtures = await createRlsFixtures(ownerQuery);
    // Todas as asserções rodam UMA vez, aqui, e cada `it` abaixo apenas inspeciona o resultado.
    // Rodá-las por `it` recriaria as fixtures a cada caso e multiplicaria o tempo por doze.
    results = await runRlsBehaviorChecks(session, fixtures);
  });

  afterAll(async () => {
    if (SKIP) {
      return;
    }
    if (owner && fixtures) {
      const ownerQuery = async (sql: string, params?: unknown[]) =>
        (await owner.query(sql, params as unknown[])).rows;
      await dropRlsFixtures(ownerQuery, fixtures).catch(() => undefined);
    }
    await app?.end().catch(() => undefined);
    await owner?.end().catch(() => undefined);
  });

  const maybe = SKIP ? it.skip : it;

  maybe('executou o conjunto completo de asserções', () => {
    // Guarda contra falha vacuosa: se as asserções não rodassem, o `forEach` abaixo não geraria
    // nenhum caso e o suite ficaria verde sem ter verificado nada.
    expect(results.length).toBeGreaterThanOrEqual(11);
  });

  maybe('nenhuma asserção de isolamento falhou', () => {
    const failed = results
      .filter((result) => !result.passed)
      .map((result) => `${result.name}: ${result.detail ?? ''}`);

    expect(failed).toEqual([]);
  });

  maybe('detalha cada asserção individualmente', () => {
    // Saída legível no relatório do jest: o caso agregado acima diz QUE falhou, este diz o quê.
    const summary = results.map((result) => `${result.passed ? '✅' : '❌'} ${result.name}`);
    // eslint-disable-next-line no-console
    console.log(summary.join('\n'));
    expect(summary.length).toBe(results.length);
  });
});
