// ⚠️ PRIMEIRO import: tradutor determinístico — sem isso, rotas de intenção fariam chamada externa.
import '../helpers/intent-test-env';

import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { Client } from 'pg';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/create-app';
import { HttpModule } from '../../src/infrastructure/http/http.module';
import { runCli } from '../helpers/run-cli';
import { connectAsOwner, deleteAccountsByDocument } from '../helpers/db';
import { cnpjWithCheckDigits } from '../helpers/document';

// Dois `create-account.cli.ts` (Nest inteiro via ts-node, ~12s cada em máquina ociosa) + o censo
// completo. Mesmo racional do admin-http-contract: teto generoso AQUI, o global de 30s continua
// valendo para o resto da suíte.
jest.setTimeout(300_000);

/**
 * SMOKE de TODAS as rotas HTTP — pedido do Eliab em 24/08/2026, depois de dois defeitos que
 * nenhum teste pegou: `GET /products` devolvendo 500 por uma linha envenenada e um 400 de
 * catálogo na Mesa. Os dois eram da mesma categoria: a rota existia, o build passava, e a
 * PRIMEIRA CHAMADA REAL quebrava.
 *
 * A lista de rotas sai do metadata do PRÓPRIO `HttpModule` (como no `route-metadata.spec`):
 * um controller novo entra na varredura sozinho, sem lista paralela para alguém esquecer.
 * Quatro varreduras, cada uma contra uma categoria de "erro simples":
 *
 *  1. **Censo GET** — toda rota GET chamada com token válido responde < 500. É o guarda direto
 *     contra a categoria "listagem quebrou em produção".
 *  2. **Censo de validação** — toda mutação (POST/PUT/PATCH/DELETE) com corpo `{}` responde
 *     < 500. Prova que o `ValidationPipe` intercepta ANTES de qualquer handler quebrar com
 *     `undefined`.
 *  3. **Censo de autenticação** — toda rota não pública, sem token, responde exatamente 401.
 *     O `route-metadata.spec` prova que o guard está DECLARADO; este prova que ele EXECUTA.
 *  4. **Isolamento entre contas** (FIN-5 aceite 5) — fixtures criadas na conta A não aparecem
 *     em nenhuma listagem da conta B, e o GET por id cruzado responde 404.
 */

const ACCOUNT_A = {
  document: cnpjWithCheckDigits('900000200001'),
  email: 'smoke-a@teste.veertex.local',
  password: randomBytes(15).toString('base64url'),
};
const ACCOUNT_B = {
  document: cnpjWithCheckDigits('900000210001'),
  email: 'smoke-b@teste.veertex.local',
  password: randomBytes(15).toString('base64url'),
};

/** Mesmas rotas públicas do `route-metadata.spec` — as duas listas mudam juntas ou o outro falha. */
const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  'HealthController.check',
  'AuthController.login',
  'AuthController.refresh',
  'AuthController.requestPasswordReset',
  'AuthController.resetPassword',
  'BillingWebhookController.receive',
]);

interface HttpRoute {
  id: string;
  method: string;
  /** Caminho com os `:params` já substituídos por UUIDs aleatórios. */
  url: string;
  /** Caminho original, para a mensagem de erro apontar a rota e não o UUID sorteado. */
  template: string;
}

function collectRoutes(): HttpRoute[] {
  const controllers: (new (...args: never[]) => object)[] =
    Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, HttpModule) ?? [];

  return controllers.flatMap((controller) => {
    const prototype = controller.prototype as Record<string, unknown>;
    const prefixRaw = Reflect.getMetadata(PATH_METADATA, controller) as string | string[];
    const prefix = Array.isArray(prefixRaw) ? prefixRaw[0] : prefixRaw;

    return Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== 'constructor')
      .filter((name) => typeof prototype[name] === 'function')
      .filter((name) => Reflect.hasMetadata(PATH_METADATA, prototype[name] as object))
      .map((name) => {
        const handler = prototype[name] as object;
        const pathRaw = Reflect.getMetadata(PATH_METADATA, handler) as string | string[];
        const path = Array.isArray(pathRaw) ? pathRaw[0] : pathRaw;
        const methodEnum = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod;
        const template = `/${prefix}/${path}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
        return {
          id: `${controller.name}.${name}`,
          method: RequestMethod[methodEnum],
          url: template.replace(/:[A-Za-z0-9_]+/g, () => randomUUID()),
          template,
        };
      });
  });
}

describe('Smoke de todas as rotas HTTP', () => {
  let owner: Client;
  let app: NestFastifyApplication;
  let baseUrl: string;
  let tokenA: string;
  let tokenB: string;

  const routes = collectRoutes();

  const call = async (
    path: string,
    init: { method?: string; body?: unknown; token?: string | null } = {},
  ): Promise<{ status: number; body: unknown }> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text; // 500 de infraestrutura pode vir como texto; o teste quer o status mesmo assim
    }
    return { status: response.status, body };
  };

  const createAccount = async (
    account: typeof ACCOUNT_A,
    name: string,
    phone: string,
  ): Promise<void> => {
    const created = await runCli(
      'create-account.cli.ts',
      [
        '--account-name',
        name,
        '--account-document',
        account.document,
        '--plan',
        'COMPLETO',
        '--company-legal-name',
        `${name} Ltda`,
        '--company-document',
        account.document,
        '--tax-regime',
        'SIMPLES',
        '--state-registration-exempt',
        '--street',
        'Rua do Smoke',
        '--number',
        '1',
        '--district',
        'Centro',
        '--city',
        'Goiania',
        '--state',
        'GO',
        '--zip',
        '74000000',
        '--admin-name',
        `Admin ${name}`,
        '--admin-email',
        account.email,
        '--admin-phone',
        phone,
      ],
      { VEERTEX_ADMIN_PASSWORD: account.password },
    );
    if (created.exitCode !== 0) {
      throw new Error(`Pré-condição falhou (${name}):\n${created.output}`);
    }
  };

  const login = async (account: typeof ACCOUNT_A): Promise<string> => {
    const response = await call('/auth/login', {
      method: 'POST',
      body: { email: account.email, password: account.password },
    });
    if (response.status !== 200) {
      throw new Error(`Login falhou (${account.email}): ${JSON.stringify(response.body)}`);
    }
    return (response.body as { accessToken: string }).accessToken;
  };

  beforeAll(async () => {
    owner = await connectAsOwner();
    await deleteAccountsByDocument(owner, [ACCOUNT_A.document, ACCOUNT_B.document]);
    await createAccount(ACCOUNT_A, 'Smoke Conta A', '62999990030');
    await createAccount(ACCOUNT_B, 'Smoke Conta B', '62999990031');

    app = await createApp();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api`;

    tokenA = await login(ACCOUNT_A);
    tokenB = await login(ACCOUNT_B);
  }, 300_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await deleteAccountsByDocument(owner, [ACCOUNT_A.document, ACCOUNT_B.document]);
    await owner.end();
  });

  it('a varredura encontra rotas (não pode passar por vacuidade)', () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it('censo GET: nenhuma rota GET devolve 500 nem recusa um token válido', async () => {
    const gets = routes.filter((route) => route.method === 'GET');
    const offenders: string[] = [];

    for (const route of gets) {
      const response = await call(route.url, { token: tokenA });
      // 200/204 = ok; 400 = query/param obrigatório ausente (validação, não defeito);
      // 404 = id sorteado não existe. 401/403 com token de plano COMPLETO é defeito de
      // wiring; >= 500 é exatamente a categoria que derrubou o GET /products.
      if (![200, 204, 400, 404].includes(response.status)) {
        offenders.push(`${route.id} GET ${route.template} → ${response.status}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('telas principais: as listagens que a retaguarda abre respondem 200 com corpo', async () => {
    // A lista curada é o contrato mínimo com o frontend: são as rotas que os services chamam ao
    // abrir cada tela. O censo acima aceita 400/404 (rotas com param); estas aqui não têm desculpa.
    const mustList = [
      '/companies',
      '/contacts',
      '/products',
      '/orders',
      '/users',
      '/roles',
      '/modules',
      '/routes',
      '/trips',
      '/price-lists',
      '/payment-conditions',
      '/finance/accounts',
      '/finance/categories',
      '/finance/receivables',
      '/finance/payables',
      '/finance/dashboard',
      '/stock/reservations',
      '/commission/b-tiers',
      '/billing/charges',
      '/billing/dunning/events',
    ];
    const offenders: string[] = [];

    for (const path of mustList) {
      const response = await call(path, { token: tokenA });
      if (response.status !== 200) {
        offenders.push(`GET ${path} → ${response.status} ${JSON.stringify(response.body)}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('censo de validação: mutação com corpo vazio nunca chega a um 500', async () => {
    const mutations = routes.filter((route) =>
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method),
    );
    const offenders: string[] = [];

    for (const route of mutations) {
      const response = await call(route.url, {
        method: route.method,
        body: route.method === 'DELETE' ? undefined : {},
        token: tokenA,
      });
      // O esperado é 400 (validação) ou 404 (id sorteado); qualquer 2xx legítimo (ex.: o Testar
      // conexão da cobrança devolve 200 {ok:false}) também passa. 500 = handler alcançado com
      // `undefined` — a categoria que este censo existe para impedir.
      if (response.status >= 500) {
        offenders.push(
          `${route.id} ${route.method} ${route.template} → ${response.status} ` +
            JSON.stringify(response.body),
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it('censo de autenticação: toda rota não pública sem token responde 401', async () => {
    const guarded = routes.filter((route) => !PUBLIC_ROUTES.has(route.id));
    const offenders: string[] = [];

    for (const route of guarded) {
      const response = await call(route.url, {
        method: route.method,
        body: ['POST', 'PUT', 'PATCH'].includes(route.method) ? {} : undefined,
        token: null,
      });
      if (response.status !== 401) {
        offenders.push(`${route.id} ${route.method} ${route.template} → ${response.status}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  describe('isolamento entre contas (FIN-5 aceite 5 — fixtures em DUAS contas)', () => {
    let contactIdA: string;
    let productIdA: string;
    let titleIdA: string;

    // Fixture que falha precisa dizer O QUE o backend respondeu — um `toBe(201)` seco esconde a
    // mensagem de validação que explica a falha.
    const created = (
      label: string,
      response: { status: number; body: unknown },
    ): { id: string } => {
      if (response.status !== 201) {
        throw new Error(
          `Fixture "${label}" falhou: ${response.status} ${JSON.stringify(response.body)}`,
        );
      }
      return response.body as { id: string };
    };

    beforeAll(async () => {
      const companies = await call('/companies', { token: tokenA });
      const companyIdA = (companies.body as { id: string }[])[0].id;

      contactIdA = created(
        'contato',
        await call('/contacts', {
          method: 'POST',
          token: tokenA,
          body: { types: ['customer'], personKind: 'company', legalName: 'Cliente Isolamento A' },
        }),
      ).id;

      productIdA = created(
        'produto',
        await call('/products', {
          method: 'POST',
          token: tokenA,
          body: { name: 'Produto Isolamento A', unit: 'UN', kind: 'product' },
        }),
      ).id;

      titleIdA = created(
        'título',
        await call('/finance/receivables', {
          method: 'POST',
          token: tokenA,
          body: {
            companyId: companyIdA,
            contactId: contactIdA,
            description: 'Título Isolamento A',
            amount: 123.45,
            dueDate: '2026-12-01T00:00:00.000Z',
          },
        }),
      ).id;
    });

    it('as listagens da conta B não contêm nada da conta A', async () => {
      const [contacts, products, titles] = await Promise.all([
        call('/contacts', { token: tokenB }),
        call('/products', { token: tokenB }),
        call('/finance/receivables', { token: tokenB }),
      ]);

      const ids = (response: { body: unknown }) =>
        (response.body as { id: string }[]).map((row) => row.id);

      expect(ids(contacts)).not.toContain(contactIdA);
      expect(ids(products)).not.toContain(productIdA);
      expect(ids(titles)).not.toContain(titleIdA);
    });

    it('GET por id cruzado responde como se o registro não existisse', async () => {
      // 404, e nunca 200: com o RLS de pé, o registro da outra conta é INVISÍVEL — responder
      // qualquer coisa que confirme a existência já seria vazamento.
      const crossed = await call(`/products/${productIdA}`, { token: tokenB });
      expect(crossed.status).toBe(404);

      // E o dono continua enxergando — prova que o 404 acima é isolamento, não rota quebrada.
      const own = await call(`/products/${productIdA}`, { token: tokenA });
      expect(own.status).toBe(200);
    });
  });
});
