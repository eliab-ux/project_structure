import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

/**
 * CARTEIRIZAÇÃO por ator (§2.3 do 02 / ADR-0007) — o teste que decide se o filtro está certo.
 *
 * Planta, na MESMA conta: dois vendedores (A e B), o contato de A, o contato de B, e um contato SEM
 * vendedor. Depois, conectado como o papel de RUNTIME (`veertex_app`, sujeito ao RLS), verifica:
 *
 *  - escopo = vendedor A  → vê SÓ o contato de A (não o de B, não o sem-dono);
 *  - escopo = vendedor B  → vê SÓ o contato de B;
 *  - escopo vazio (admin) → vê os três.
 *
 * E SABOTA antes de confiar (regra 6 do CLAUDE.md): recria a policy SEM a cláusula de carteirização
 * e confirma que o escopo de A passa a vazar os três — provando que o teste pega o defeito. Depois
 * restaura a policy real.
 *
 * Roda como `veertex_app`: como o dono ignora as policies, rodar como ele deixaria tudo verde com o
 * isolamento desligado.
 */

const OWNER_URL = process.env.DATABASE_URL_MIGRATIONS;
const APP_URL = process.env.DATABASE_URL;
const SKIP = process.env.VEERTEX_SKIP_DB_TESTS === 'true';

const TENANT_SCOPE = `nullif(current_setting('app.account_id', true), '')::uuid`;
const CONTACT_SCOPE = `nullif(current_setting('app.contact_scope', true), '')`;

const POLICY_WITH_CARTEIRA = `
  create policy "contacts_tenant_isolation" on "contacts"
    for all
    using (
      "account_id" = ${TENANT_SCOPE}
      and (${CONTACT_SCOPE} is null or "sales_rep_id" = ${CONTACT_SCOPE}::uuid)
    )
    with check ("account_id" = ${TENANT_SCOPE});
`;

const POLICY_ACCOUNT_ONLY = `
  create policy "contacts_tenant_isolation" on "contacts"
    for all
    using ("account_id" = ${TENANT_SCOPE})
    with check ("account_id" = ${TENANT_SCOPE});
`;

describe('Carteirização por ator (RLS) — §2.3 / ADR-0007', () => {
  let owner: Client;
  let app: Client;

  const ids = {
    plan: randomUUID(),
    account: randomUUID(),
    role: randomUUID(),
    sellerA: randomUUID(),
    sellerB: randomUUID(),
    contactA: randomUUID(),
    contactB: randomUUID(),
    contactNone: randomUUID(),
  };

  /** Lê os contatos visíveis sob um escopo de ator (transaction-local, como no runtime real). */
  async function visibleUnder(contactScope: string): Promise<string[]> {
    await app.query('begin');
    try {
      await app.query(`select set_config('app.account_id', $1, true)`, [ids.account]);
      await app.query(`select set_config('app.contact_scope', $1, true)`, [contactScope]);
      const res = await app.query('select id from contacts order by legal_name');
      return res.rows.map((r) => r.id as string);
    } finally {
      await app.query('rollback');
    }
  }

  beforeAll(async () => {
    if (SKIP) {
      return;
    }
    if (!OWNER_URL || !APP_URL) {
      throw new Error(
        'DATABASE_URL e DATABASE_URL_MIGRATIONS são necessárias. Para pular, VEERTEX_SKIP_DB_TESTS=true.',
      );
    }
    owner = new Client({ connectionString: OWNER_URL });
    app = new Client({ connectionString: APP_URL });
    await owner.connect();
    await app.connect();

    // ── Fixtures, plantadas como OWNER (que cruza contas legitimamente) ──────────────────────────
    await owner.query(
      `insert into plans (id, code, name, limits, active, created_at)
       values ($1, $2, 'Plano Teste Carteira', '{}'::jsonb, true, now())`,
      [ids.plan, `CART_${ids.plan.slice(0, 8)}`],
    );
    await owner.query(
      `insert into accounts (id, name, document, plan_id, status, timezone, contact_carteirizacao, created_at, updated_at)
       values ($1, 'Conta Carteira', $2, $3, 'ACTIVE', 'America/Sao_Paulo', true, now(), now())`,
      [ids.account, ids.account.replace(/\D/g, '').slice(0, 14).padEnd(14, '0'), ids.plan],
    );
    await owner.query(
      `insert into roles (id, account_id, code, name, permissions, is_system, created_at, updated_at)
       values ($1, $2, 'SELLER', 'Vendedor', '[]'::jsonb, false, now(), now())`,
      [ids.role, ids.account],
    );
    for (const [id, email, phone] of [
      [ids.sellerA, 'a@carteira.test', '+5562990000001'],
      [ids.sellerB, 'b@carteira.test', '+5562990000002'],
    ]) {
      await owner.query(
        `insert into users (id, account_id, name, email, phone, password_hash, role_id, status, created_at, updated_at)
         values ($1, $2, 'Vendedor', $3, $4, 'x', $5, 'ACTIVE', now(), now())`,
        [id, ids.account, email, phone, ids.role],
      );
    }
    for (const [id, name, seller] of [
      [ids.contactA, 'Contato A', ids.sellerA],
      [ids.contactB, 'Contato B', ids.sellerB],
      [ids.contactNone, 'Contato Sem Dono', null],
    ]) {
      await owner.query(
        `insert into contacts (id, account_id, created_at, updated_at, types, person_kind, legal_name, sales_rep_id, active)
         values ($1, $2, now(), now(), ARRAY['customer']::text[], 'company', $3, $4, true)`,
        [id, ids.account, name, seller],
      );
    }
  });

  afterAll(async () => {
    if (SKIP) {
      return;
    }
    if (owner) {
      await owner
        .query('delete from contacts where account_id = $1', [ids.account])
        .catch(() => undefined);
      await owner
        .query('delete from users where account_id = $1', [ids.account])
        .catch(() => undefined);
      await owner
        .query('delete from roles where account_id = $1', [ids.account])
        .catch(() => undefined);
      await owner.query('delete from accounts where id = $1', [ids.account]).catch(() => undefined);
      await owner.query('delete from plans where id = $1', [ids.plan]).catch(() => undefined);
    }
    await app?.end().catch(() => undefined);
    await owner?.end().catch(() => undefined);
  });

  const maybe = SKIP ? it.skip : it;

  maybe('vendedor A vê SÓ o contato de A', async () => {
    expect(await visibleUnder(ids.sellerA)).toEqual([ids.contactA]);
  });

  maybe('vendedor B vê SÓ o contato de B', async () => {
    expect(await visibleUnder(ids.sellerB)).toEqual([ids.contactB]);
  });

  maybe('sem escopo (admin/não restrito) vê os três', async () => {
    const visible = await visibleUnder('');
    expect(visible.sort()).toEqual([ids.contactA, ids.contactB, ids.contactNone].sort());
  });

  maybe('contato sem vendedor NÃO aparece para um ator restrito', async () => {
    expect(await visibleUnder(ids.sellerA)).not.toContain(ids.contactNone);
  });

  maybe('SABOTAGEM: sem a cláusula de carteirização, o escopo de A vaza os três', async () => {
    // Troca a policy pela versão só-por-conta e confirma que o teste FICA VERMELHO (vaza).
    await owner.query('drop policy if exists "contacts_tenant_isolation" on "contacts"');
    await owner.query(POLICY_ACCOUNT_ONLY);
    try {
      const leaked = await visibleUnder(ids.sellerA);
      expect(leaked.sort()).toEqual([ids.contactA, ids.contactB, ids.contactNone].sort());
    } finally {
      // Restaura a policy REAL, aconteça o que acontecer com a asserção acima.
      await owner.query('drop policy if exists "contacts_tenant_isolation" on "contacts"');
      await owner.query(POLICY_WITH_CARTEIRA);
    }
    // E confirma que, restaurada, A volta a ver só o dele.
    expect(await visibleUnder(ids.sellerA)).toEqual([ids.contactA]);
  });
});
