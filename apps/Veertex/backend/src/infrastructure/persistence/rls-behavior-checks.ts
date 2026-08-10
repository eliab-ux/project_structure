import { randomUUID } from 'crypto';

/**
 * As asserções de COMPORTAMENTO do RLS — o critério de aceite §7.2, executável.
 *
 * Complementa `isolation-invariants.ts`, que confere a CONFIGURAÇÃO (dono das tabelas, atributos de
 * papel, grants, policies existirem). Aqui se prova que a configuração produz o efeito: uma consulta
 * sem escopo não devolve linha, o escopo de uma conta não alcança a outra, e a escrita cruzada é
 * recusada. Uma coisa não substitui a outra — policy pode existir e estar escrita errada.
 *
 * Vive num módulo próprio, e não dentro do arquivo de teste, por um motivo prático: a imagem de
 * runtime não carrega `test/` nem o jest, e a verificação precisa rodar DENTRO do container (é lá
 * que o banco é alcançável). Então o jest e o CLI compilado consomem exatamente as mesmas
 * asserções, em vez de duas cópias que divergem na primeira correção.
 */

export type OwnerQuery = (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

/** A sessão do papel de RUNTIME. Precisa de controle de transação: o escopo é transaction-local. */
export interface AppSession {
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface RlsCheckResult {
  name: string;
  passed: boolean;
  /** Presente quando falhou: o que se esperava e o que veio. */
  detail?: string;
}

export interface RlsFixtures {
  planCode: string;
  accountA: string;
  accountB: string;
  userA: string;
  userB: string;
  roleA: string;
  roleB: string;
}

/**
 * As tabelas de negócio cujo isolamento é asseverado aqui.
 *
 * Lista estática, ao contrário do `isolation-invariants.ts`, que deriva de `pg_attribute`. A
 * divisão de trabalho é deliberada: quem garante que nenhuma tabela nova escape é o verificador de
 * INVARIANTES — ele descobre qualquer tabela com `account_id` e falha se faltar policy. Esta lista
 * é sobre COBERTURA das asserções de comportamento, e uma tabela esquecida aqui reduz cobertura sem
 * abrir furo.
 *
 * `account_modules` entrou com a F2.
 */
const TENANT_TABLES = [
  'companies',
  'roles',
  'users',
  'password_reset_codes',
  'account_modules',
] as const;
const SCOPE_SQL = `select set_config('app.account_id', $1, true)`;

/**
 * Cria duas contas completas com o papel de OWNER.
 *
 * DUAS, porque a maior parte dos furos de multi-tenancy só é observável quando existe um segundo
 * tenant para vazar: com uma conta só, a consulta sem escopo devolve o mesmo que a escopada.
 *
 * Ids e documentos aleatórios em cada execução, para o verificador poder rodar num banco que já tem
 * dados reais sem colidir com nada e sem depender de estado prévio.
 */
export async function createRlsFixtures(owner: OwnerQuery): Promise<RlsFixtures> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10);
  const fixtures: RlsFixtures = {
    planCode: `VERIFY_${suffix.slice(0, 6).toUpperCase()}`,
    accountA: randomUUID(),
    accountB: randomUUID(),
    roleA: randomUUID(),
    roleB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
  };

  await owner(
    `insert into plans (id, code, name, limits, active)
          values ($1, $2, 'Plano de verificação', '{"maxCompanies":null,"maxUsers":null,"modules":["CORE"]}'::jsonb, true)`,
    [randomUUID(), fixtures.planCode],
  );
  const plan = await owner('select id from plans where code = $1', [fixtures.planCode]);
  const planId = plan[0].id as string;

  const pairs = [
    { account: fixtures.accountA, role: fixtures.roleA, user: fixtures.userA, tag: 'a' },
    { account: fixtures.accountB, role: fixtures.roleB, user: fixtures.userB, tag: 'b' },
  ];

  for (const pair of pairs) {
    await owner(
      `insert into accounts (id, name, document, plan_id, status, timezone)
            values ($1, $2, $3, $4, 'ACTIVE', 'America/Sao_Paulo')`,
      [
        pair.account,
        `Verificação ${pair.tag}`,
        // Documento sintético de 14 dígitos derivado do uuid: não passa por validação de domínio
        // (é INSERT direto), e só precisa ser único.
        pair.account.replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
        planId,
      ],
    );
    await owner(
      `insert into roles (id, account_id, code, name, permissions, is_system)
            values ($1, $2, 'ADMIN', 'Administrador', '["*"]'::jsonb, true)`,
      [pair.role, pair.account],
    );
    await owner(
      `insert into users (id, account_id, name, email, phone, password_hash, role_id, status)
            values ($1, $2, $3, $4, '+5562999990000', 'not-a-real-hash', $5, 'ACTIVE')`,
      [
        pair.user,
        pair.account,
        `Usuário ${pair.tag}`,
        `${pair.tag}-${pair.user}@verify.local`,
        pair.role,
      ],
    );
  }

  return fixtures;
}

/**
 * Remove as fixtures. Usa DELETE de verdade (não soft delete) porque estas linhas nunca foram dado
 * de negócio — e deixá-las como "excluídas" poluiria relatório futuro com contas que nunca
 * existiram. Roda como OWNER, o único papel com DELETE.
 */
export async function dropRlsFixtures(owner: OwnerQuery, fixtures: RlsFixtures): Promise<void> {
  for (const accountId of [fixtures.accountA, fixtures.accountB]) {
    await owner('delete from password_reset_codes where account_id = $1', [accountId]);
    await owner('delete from account_modules where account_id = $1', [accountId]);
    await owner('delete from companies where account_id = $1', [accountId]);
    await owner('delete from users where account_id = $1', [accountId]);
    await owner('delete from roles where account_id = $1', [accountId]);
    await owner('delete from accounts where id = $1', [accountId]);
  }
  await owner('delete from plans where code = $1', [fixtures.planCode]);
}

/**
 * Roda todas as asserções e devolve o resultado de cada uma.
 *
 * Não lança em falha de asserção — devolve `passed: false`. Assim o CLI consegue reportar TODAS as
 * violações de uma vez, em vez de o operador descobrir uma, corrigir, rodar de novo e descobrir a
 * seguinte.
 */
export async function runRlsBehaviorChecks(
  app: AppSession,
  fixtures: RlsFixtures,
): Promise<RlsCheckResult[]> {
  const results: RlsCheckResult[] = [];

  const check = async (name: string, fn: () => Promise<string | null>): Promise<void> => {
    await app.begin();
    try {
      const failure = await fn();
      results.push(failure ? { name, passed: false, detail: failure } : { name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, detail: (error as Error)?.message ?? String(error) });
    } finally {
      // Sempre rollback: a verificação não deixa rastro, e pode rodar em banco com dado real.
      await app.rollback().catch(() => undefined);
    }
  };

  const countOf = async (table: string): Promise<number> => {
    const rows = await app.query(`select count(*)::int as total from ${table}`);
    return Number(rows[0].total);
  };

  // ── Sem escopo estabelecido ───────────────────────────────────────────────────────────────
  for (const table of TENANT_TABLES) {
    await check(`sem escopo: "${table}" devolve zero linhas`, async () => {
      const total = await countOf(table);
      return total === 0 ? null : `esperado 0, veio ${total}`;
    });
  }

  await check('sem escopo: "accounts" devolve zero linhas', async () => {
    const total = await countOf('accounts');
    return total === 0 ? null : `esperado 0, veio ${total}`;
  });

  await check('GUC vazio não abre nada', async () => {
    // É o valor que o subscriber escreve quando não há tenant. O nullif das policies o vira NULL.
    await app.query(SCOPE_SQL, ['']);
    const total = await countOf('users');
    return total === 0 ? null : `esperado 0, veio ${total}`;
  });

  // ── Com escopo ────────────────────────────────────────────────────────────────────────────
  await check('escopo da conta A enxerga só a conta A', async () => {
    await app.query(SCOPE_SQL, [fixtures.accountA]);

    const users = await app.query('select id, account_id from users');
    if (users.length !== 1) {
      return `esperado 1 usuário, veio ${users.length}`;
    }
    if (users[0].id !== fixtures.userA) {
      return `usuário inesperado: ${String(users[0].id)}`;
    }

    const accounts = await app.query('select id from accounts');
    if (accounts.length !== 1 || accounts[0].id !== fixtures.accountA) {
      return `esperado só a conta A em accounts, veio ${accounts.length} linha(s)`;
    }
    return null;
  });

  await check('id da outra conta devolve vazio, não erro', async () => {
    await app.query(SCOPE_SQL, [fixtures.accountA]);
    const rows = await app.query('select id from users where id = $1', [fixtures.userB]);
    return rows.length === 0 ? null : 'a linha da conta B foi visível sob o escopo da conta A';
  });

  // ── O escopo não sobrevive à transação ────────────────────────────────────────────────────
  // Não usa o helper `check`, porque precisa de um COMMIT no meio — é justamente o commit que prova
  // que o set_config era transaction-local e não de sessão.
  {
    const name = 'o escopo morre no commit (não vaza pelo pool)';
    try {
      await app.begin();
      await app.query(SCOPE_SQL, [fixtures.accountA]);
      await app.commit();

      await app.begin();
      const total = await countOf('users');
      await app.rollback();

      results.push(
        total === 0
          ? { name, passed: true }
          : {
              name,
              passed: false,
              detail: `esperado 0 após o commit, veio ${total} — o escopo é de SESSÃO e vaza para a próxima requisição que pegar esta conexão`,
            },
      );
    } catch (error) {
      await app.rollback().catch(() => undefined);
      results.push({ name, passed: false, detail: (error as Error)?.message });
    }
  }

  // ── Escrita ───────────────────────────────────────────────────────────────────────────────
  await check('INSERT com account_id alheio é recusado (WITH CHECK)', async () => {
    try {
      await app.query(
        `insert into roles (id, account_id, code, name, permissions, is_system)
              values ($1, $2, 'INTRUSO', 'Intruso', '[]'::jsonb, false)`,
        [randomUUID(), fixtures.accountB],
      );
      return 'o INSERT passou — a policy não tem WITH CHECK efetivo';
    } catch (error) {
      const message = (error as Error)?.message ?? '';
      return /row-level security/i.test(message)
        ? null
        : `recusado, mas por outro motivo: ${message}`;
    }
  });

  await check('UPDATE em linha de outra conta afeta zero linhas', async () => {
    await app.query(SCOPE_SQL, [fixtures.accountA]);
    const rows = await app.query('update users set name = $1 where id = $2 returning id', [
      'invadido',
      fixtures.userB,
    ]);
    return rows.length === 0 ? null : 'a linha da conta B foi atualizada sob o escopo da conta A';
  });

  await check('o papel de runtime não tem DELETE', async () => {
    await app.query(SCOPE_SQL, [fixtures.accountA]);
    try {
      await app.query('delete from users where id = $1', [fixtures.userA]);
      return 'o DELETE passou — o papel de runtime tem privilégio que não deveria ter';
    } catch (error) {
      const message = (error as Error)?.message ?? '';
      return /permission denied/i.test(message)
        ? null
        : `recusado, mas por outro motivo: ${message}`;
    }
  });

  return results;
}
