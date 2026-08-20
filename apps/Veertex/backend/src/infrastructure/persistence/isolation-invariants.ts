/**
 * The invariants that make tenant isolation real — checked against a live database.
 *
 * These exist because the F1 design deliberately uses `ENABLE ROW LEVEL SECURITY` rather than
 * `FORCE` (see the migration's header). That choice is safe for exactly one reason: **the
 * application never connects as a role that can bypass the policies.** Which means the security of
 * the whole system rests on facts that live outside the codebase — who owns a table, which
 * attributes a role carries, which grants were issued.
 *
 * A `GRANT` typed by hand at 2am, a table created by the wrong role in a future migration, an
 * `ALTER ROLE ... BYPASSRLS` added to debug something and never reverted: each silently turns RLS
 * into decoration, and none of them changes a line of TypeScript. Nothing in a build would notice.
 * This does.
 *
 * Pure on purpose — it takes a query function instead of a client, so the same checks run from the
 * `verify:isolation` CLI and from the integration test suite without either owning the connection.
 */

export interface IsolationViolation {
  check: string;
  detail: string;
}

export interface IsolationRoles {
  /** Owns the schema; runs migrations and operator tooling. Bypasses RLS BY OWNERSHIP. */
  owner: string;
  /** The runtime role the API connects with. Must be subject to RLS in every respect. */
  app: string;
}

export const DEFAULT_ISOLATION_ROLES: IsolationRoles = {
  owner: 'veertex_owner',
  app: 'veertex_app',
};

/** Privileges the runtime role must never hold: deletion in Veertex is a soft delete (an UPDATE). */
const FORBIDDEN_PRIVILEGES = ['DELETE', 'TRUNCATE'];

const AUTH_FUNCTION = 'veertex_auth_find_user_by_email';

export type SqlExecutor = (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

/**
 * Verifies WHO the application actually connects as — a question every other check here leaves open.
 *
 * ## The gap this closes, found on 20/08/2026 during the first Dokploy deploy
 *
 * Every invariant below inspects the roles BY NAME (`veertex_owner`, `veertex_app`): their
 * attributes, their grants, who owns the tables. All of it can be perfectly configured while the
 * running API connects as `postgres` — because someone pasted Dokploy's "Internal Connection URL"
 * into `DATABASE_URL`, which is the credential of the database SERVICE, not of the runtime role.
 *
 * In that state the boot verification passed and printed "isolamento íntegro", while the API held a
 * superuser connection: RLS silently inert, DDL and DELETE available, and every account visible to
 * every request. The check that exists to catch exactly this did not look at it.
 *
 * It runs with the RUNTIME connection on purpose — `current_user` is the only way to answer the
 * question, and no amount of catalogue reading substitutes for asking the connection itself.
 */
export async function verifyRuntimeIdentity(
  runtimeQuery: SqlExecutor,
  roles: IsolationRoles = DEFAULT_ISOLATION_ROLES,
): Promise<IsolationViolation[]> {
  const violations: IsolationViolation[] = [];

  const [row] = await runtimeQuery(
    `select current_user as usuario,
            current_database() as banco,
            current_setting('is_superuser') as superusuario,
            (select rolbypassrls from pg_roles where rolname = current_user) as bypassrls`,
  );

  if (!row) {
    violations.push({
      check: 'runtime-identity',
      detail: 'A conexão de runtime não respondeu quem ela é — verificação impossível.',
    });
    return violations;
  }

  if (row.usuario !== roles.app) {
    violations.push({
      check: 'runtime-identity',
      detail:
        `A aplicação conecta como "${row.usuario}", não como "${roles.app}". ` +
        'Confira DATABASE_URL: no Dokploy, a "Internal Connection URL" do serviço de banco é a ' +
        'credencial DELE (normalmente superusuário), e não a do papel de runtime.',
    });
  }

  // 'on' aqui é o fim do isolamento: superusuário ignora toda policy, incondicionalmente.
  if (String(row.superusuario) === 'on') {
    violations.push({
      check: 'runtime-identity',
      detail: `A conexão de runtime é SUPERUSUÁRIO ("${row.usuario}"). Toda policy de RLS é ignorada.`,
    });
  }

  if (row.bypassrls === true) {
    violations.push({
      check: 'runtime-identity',
      detail: `A conexão de runtime tem BYPASSRLS ("${row.usuario}"). Toda policy de RLS é ignorada.`,
    });
  }

  return violations;
}

export async function verifyIsolationInvariants(
  query: SqlExecutor,
  roles: IsolationRoles = DEFAULT_ISOLATION_ROLES,
): Promise<IsolationViolation[]> {
  const violations: IsolationViolation[] = [];

  // ── A. Ownership ──────────────────────────────────────────────────────────────────────────
  // A table owned by anyone else is a table its owner reads unfiltered. If that owner is the
  // runtime role, RLS does nothing at all for it — the exact failure `FORCE` would have caught,
  // which is why this check is the price of not using FORCE.
  const wrongOwner = await query(
    `select c.relname as table_name, pg_get_userbyid(c.relowner) as owner
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and pg_get_userbyid(c.relowner) <> $1
      order by c.relname`,
    [roles.owner],
  );
  for (const row of wrongOwner) {
    violations.push({
      check: 'ownership',
      detail: `Tabela "${row.table_name}" pertence a "${row.owner}", não a "${roles.owner}". O dono ignora as policies.`,
    });
  }

  // ── B/C. Role attributes ──────────────────────────────────────────────────────────────────
  const roleRows = await query(
    `select rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
       from pg_roles where rolname = any($1)`,
    [[roles.owner, roles.app]],
  );
  const byName = new Map(roleRows.map((row) => [row.rolname as string, row]));

  for (const roleName of [roles.owner, roles.app]) {
    const row = byName.get(roleName);
    if (!row) {
      violations.push({
        check: 'roles',
        detail: `Papel "${roleName}" não existe. Rode deploy/sql/001_create_roles.sql.`,
      });
      continue;
    }
    if (row.rolsuper === true) {
      violations.push({
        check: 'roles',
        detail: `Papel "${roleName}" é SUPERUSER — superusuário ignora RLS incondicionalmente.`,
      });
    }
    if (row.rolbypassrls === true) {
      violations.push({
        check: 'roles',
        detail: `Papel "${roleName}" tem BYPASSRLS — todo o isolamento entre contas fica decorativo.`,
      });
    }
    // CREATEDB e CREATEROLE não furam o RLS diretamente, mas dão o caminho: com CREATEROLE um papel
    // se concede BYPASSRLS a si mesmo, e com CREATEDB cria um banco onde é dono de tudo. São
    // escalada de privilégio em um passo, e o `001_create_roles.sql` os nega explicitamente — este
    // invariante existe para detectar quando alguém os devolve.
    if (row.rolcreatedb === true) {
      violations.push({
        check: 'roles',
        detail: `Papel "${roleName}" tem CREATEDB — pode criar um banco onde é dono de todas as tabelas.`,
      });
    }
    if (row.rolcreaterole === true) {
      violations.push({
        check: 'roles',
        detail: `Papel "${roleName}" tem CREATEROLE — pode conceder BYPASSRLS a si mesmo.`,
      });
    }
  }

  // ── D/E. RLS ligado e com policy em toda tabela de tenant ─────────────────────────────────
  // The set is derived from the SCHEMA (any table carrying `account_id`), not from a hardcoded
  // list. A future migration that adds a tenant table and forgets the policy is then caught here
  // instead of shipping — a list would have had to be remembered too.
  const tenantTables = await query(
    `select c.relname as table_name, c.relrowsecurity as rls_enabled,
            (select count(*) from pg_policy p where p.polrelid = c.oid) as policy_count
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and (
          exists (
            select 1 from pg_attribute a
             where a.attrelid = c.oid and a.attname = 'account_id' and a.attnum > 0 and not a.attisdropped
          )
          or c.relname = 'accounts'
        )
      order by c.relname`,
  );

  if (tenantTables.length === 0) {
    violations.push({
      check: 'rls',
      detail: 'Nenhuma tabela de tenant encontrada. As migrations foram aplicadas neste banco?',
    });
  }

  for (const row of tenantTables) {
    if (row.rls_enabled !== true) {
      violations.push({
        check: 'rls',
        detail: `Tabela "${row.table_name}" tem account_id mas está SEM row level security.`,
      });
    }
    if (Number(row.policy_count) === 0) {
      violations.push({
        check: 'rls',
        detail: `Tabela "${row.table_name}" tem RLS ligado e NENHUMA policy — nega tudo, inclusive o que deveria passar.`,
      });
    }
  }

  // ── F. Grants proibidos ao papel de runtime ───────────────────────────────────────────────
  const grants = await query(
    `select table_name, privilege_type
       from information_schema.role_table_grants
      where grantee = $1 and table_schema = 'public' and privilege_type = any($2)
      order by table_name, privilege_type`,
    [roles.app, FORBIDDEN_PRIVILEGES],
  );
  for (const row of grants) {
    violations.push({
      check: 'grants',
      detail: `"${roles.app}" tem ${row.privilege_type} em "${row.table_name}". Exclusão no Veertex é soft delete (UPDATE).`,
    });
  }

  // ── G. A função SECURITY DEFINER de autenticação ──────────────────────────────────────────
  // It is the single sanctioned way past RLS, so its three properties are load-bearing: owned by
  // the owner (or it cannot read across tenants), `security definer` (or it runs as the caller and
  // returns nothing), and a FIXED search_path — without which a schema planted ahead of `public`
  // in the caller's search_path could hijack name resolution inside a function running with the
  // owner's privileges.
  const functions = await query(
    `select p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) as owner
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1`,
    [AUTH_FUNCTION],
  );

  if (functions.length === 0) {
    violations.push({
      check: 'auth-function',
      detail: `Função "${AUTH_FUNCTION}" não existe — o login não consegue localizar o usuário e nenhuma autenticação funciona.`,
    });
  }

  for (const row of functions) {
    if (row.prosecdef !== true) {
      violations.push({
        check: 'auth-function',
        detail: `"${AUTH_FUNCTION}" não é SECURITY DEFINER — rodaria como o chamador e o RLS devolveria zero linhas.`,
      });
    }
    if (row.owner !== roles.owner) {
      violations.push({
        check: 'auth-function',
        detail: `"${AUTH_FUNCTION}" pertence a "${row.owner}", não a "${roles.owner}".`,
      });
    }
    const config = (row.proconfig as string[] | null) ?? [];
    if (!config.some((entry) => entry.startsWith('search_path='))) {
      violations.push({
        check: 'auth-function',
        detail: `"${AUTH_FUNCTION}" não fixa search_path — requisito de toda função SECURITY DEFINER.`,
      });
    }
  }

  return violations;
}
