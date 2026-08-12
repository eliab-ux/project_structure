import { randomBytes } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { Client } from 'pg';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/create-app';
import { runCli } from '../helpers/run-cli';
import { connectAsOwner, deleteAccountsByDocument } from '../helpers/db';
import { cnpjWithCheckDigits } from '../helpers/document';

/**
 * O CONTRATO HTTP que as telas de administração do frontend consomem.
 *
 * Cada requisição aqui usa exatamente o caminho, o método e o formato de corpo que
 * `frontend/src/services/{company,user,role}Service.ts` usa. É essa correspondência que dá valor ao
 * arquivo: um `/companies/:id/status` que virasse `/companies/:id/active` no backend continuaria
 * com todos os testes de use case passando, o build do frontend passando, e a tela quebrada.
 *
 * Sobe pelo `createApp()` — mesma wiring do `main.ts`, com prefixo `/api`, `ValidationPipe` e
 * `GlobalExceptionFilter`. Sem isso o teste não veria o `forbidNonWhitelisted`, que é justamente o
 * que recusa um corpo com campo a mais.
 *
 * ⚠️ Ao mexer nos services do frontend, mexa aqui junto. Os dois lados do contrato precisam mudar
 * na mesma alteração, ou este teste vira uma descrição do passado.
 */

const ACCOUNT = {
  document: cnpjWithCheckDigits('900000080001'),
  email: 'contrato@teste.veertex.local',
  password: randomBytes(15).toString('base64url'),
};

const NEW_COMPANY_DOCUMENT = cnpjWithCheckDigits('900000090001');

describe('Contrato HTTP das telas de administração', () => {
  let owner: Client;
  let app: NestFastifyApplication;
  let baseUrl: string;
  let token: string;

  const call = async (
    path: string,
    init: { method?: string; body?: unknown; auth?: boolean } = {},
  ): Promise<{ status: number; body: unknown }> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(init.auth === false ? {} : { Authorization: `Bearer ${token}` }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };

  beforeAll(async () => {
    owner = await connectAsOwner();
    await deleteAccountsByDocument(owner, [ACCOUNT.document, NEW_COMPANY_DOCUMENT]);

    const created = await runCli(
      'create-account.cli.ts',
      [
        '--account-name',
        'Conta do Contrato',
        '--account-document',
        ACCOUNT.document,
        '--plan',
        'COMPLETO',
        '--company-legal-name',
        'Conta do Contrato Ltda',
        '--company-document',
        ACCOUNT.document,
        '--tax-regime',
        'SIMPLES',
        '--state-registration-exempt',
        '--street',
        'Rua do Contrato',
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
        'Admin do Contrato',
        '--admin-email',
        ACCOUNT.email,
        '--admin-phone',
        '62999990020',
      ],
      { VEERTEX_ADMIN_PASSWORD: ACCOUNT.password },
    );
    if (created.exitCode !== 0) {
      throw new Error(`Pré-condição falhou:\n${created.output}`);
    }

    app = await createApp();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api`;

    const login = await call('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email: ACCOUNT.email, password: ACCOUNT.password },
    });
    token = (login.body as { accessToken: string }).accessToken;
  }, 180_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await deleteAccountsByDocument(owner, [ACCOUNT.document, NEW_COMPANY_DOCUMENT]);
    await owner.end();
  });

  describe('companyService', () => {
    let companyId: string;

    it('GET /companies — list()', async () => {
      const response = await call('/companies');

      expect(response.status).toBe(200);
      const companies = response.body as { id: string; displayName: string; active: boolean }[];
      expect(companies.length).toBeGreaterThan(0);
      // Os campos que a tabela da tela renderiza. Se algum sumir, a coluna fica vazia sem erro.
      expect(companies[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          displayName: expect.any(String),
          documentFormatted: expect.any(String),
          taxRegime: expect.any(String),
          active: expect.any(Boolean),
          address: expect.objectContaining({ city: expect.any(String), state: expect.any(String) }),
        }),
      );
      companyId = companies[0].id;
    });

    it('GET /companies?includeInactive=true — list(true)', async () => {
      const response = await call('/companies?includeInactive=true');
      expect(response.status).toBe(200);
    });

    it('POST /companies — create()', async () => {
      const response = await call('/companies', {
        method: 'POST',
        body: {
          legalName: 'Segunda Empresa Ltda',
          tradeName: 'Segunda',
          document: NEW_COMPANY_DOCUMENT,
          taxRegime: 'SIMPLES',
          stateRegistrationExempt: true,
          stateRegistration: null,
          municipalRegistration: null,
          cnae: null,
          address: {
            street: 'Rua Nova',
            number: '2',
            complement: null,
            district: 'Centro',
            city: 'Goiania',
            state: 'GO',
            zipCode: '74000000',
            ibgeCityCode: null,
          },
          contactEmail: null,
          billingEmail: null,
          phone: null,
        },
      });

      // 201 estrito. Não há teto de empresas: o §3.2 do CORE fala em "N empresas por conta", e
      // `plan.limits` é lista de códigos de MÓDULO, não um número de empresas. Uma asserção que
      // aceitasse 400 aqui deixaria passar uma recusa que não deveria existir.
      expect(response.status).toBe(201);
      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          document: NEW_COMPANY_DOCUMENT,
          active: true,
        }),
      );
    });

    it('PATCH /companies/:id — update() sem o campo document', async () => {
      const response = await call(`/companies/${companyId}`, {
        method: 'PATCH',
        body: { legalName: 'Conta do Contrato Ltda ME' },
      });

      expect(response.status).toBe(200);
      expect((response.body as { legalName: string }).legalName).toBe('Conta do Contrato Ltda ME');
    });

    it('PATCH /companies/:id recusa o campo document (forbidNonWhitelisted)', async () => {
      // A razão de o `update()` do service remover o documento do payload. Se um dia o backend
      // passasse a aceitá-lo em silêncio, este teste avisaria antes de alguém trocar um CNPJ.
      const response = await call(`/companies/${companyId}`, {
        method: 'PATCH',
        body: { legalName: 'Qualquer', document: NEW_COMPANY_DOCUMENT },
      });

      expect(response.status).toBe(400);
    });

    it('PATCH /companies/:id/status — setActive()', async () => {
      const off = await call(`/companies/${companyId}/status`, {
        method: 'PATCH',
        body: { active: false },
      });
      expect(off.status).toBe(200);
      expect((off.body as { active: boolean }).active).toBe(false);

      const on = await call(`/companies/${companyId}/status`, {
        method: 'PATCH',
        body: { active: true },
      });
      expect((on.body as { active: boolean }).active).toBe(true);
    });

    it('aceita a QUARTA empresa — não há teto de empresas por plano', async () => {
      // A regressão do default silencioso removido em 12/08/2026. O plano COMPLETO desta conta
      // limitava a 3 empresas, número que requisito nenhum pediu (§3.1: "plano define teto de
      // MÓDULOS"; §3.2: "N empresas por conta"). A conta já tem duas — a do onboarding e a criada
      // acima —, então a quarta é a que a versão anterior recusaria.
      //
      // Este teste é o que impede o teto de voltar. Sem ele, reintroduzir `maxCompanies` passaria
      // verde: nenhum outro teste cria empresa suficiente para encostar em três.
      const extras = [cnpjWithCheckDigits('900000091001'), cnpjWithCheckDigits('900000092001')];

      try {
        for (const [index, document] of extras.entries()) {
          const response = await call('/companies', {
            method: 'POST',
            body: {
              legalName: `Empresa Extra ${index + 3} Ltda`,
              tradeName: null,
              document,
              taxRegime: 'SIMPLES',
              stateRegistrationExempt: true,
              stateRegistration: null,
              municipalRegistration: null,
              cnae: null,
              address: {
                street: 'Rua Extra',
                number: String(index + 3),
                complement: null,
                district: 'Centro',
                city: 'Goiania',
                state: 'GO',
                zipCode: '74000000',
                ibgeCityCode: null,
              },
              contactEmail: null,
              billingEmail: null,
              phone: null,
            },
          });

          expect({ empresa: index + 3, status: response.status }).toEqual({
            empresa: index + 3,
            status: 201,
          });
        }

        const all = (await call('/companies')).body as unknown[];
        expect(all.length).toBeGreaterThanOrEqual(4);
      } finally {
        // As extras pendem da conta do spec, que o afterAll apaga — mas apagar aqui mantém a
        // contagem previsível se este bloco crescer.
        await deleteAccountsByDocument(owner, extras);
      }
    });
  });

  describe('roleService', () => {
    let createdRoleId: string;

    it('GET /roles — list()', async () => {
      const response = await call('/roles');

      expect(response.status).toBe(200);
      const roles = response.body as { code: string; isSystem: boolean; permissions: string[] }[];
      // Os sete papéis do onboarding, todos de sistema.
      expect(roles).toHaveLength(7);
      expect(roles.every((role) => role.isSystem)).toBe(true);
      expect(roles.find((role) => role.code === 'ADMIN')).toBeDefined();
    });

    it('GET /roles/catalog — permissionCatalog()', async () => {
      const response = await call('/roles/catalog');

      expect(response.status).toBe(200);
      const catalog = response.body as { areas: string[]; permissions: string[] };
      // A tela agrupa por área com `permission.startsWith(area + '.')`. Se as duas listas
      // deixassem de casar, os grupos apareceriam vazios sem erro nenhum.
      expect(catalog.areas.length).toBeGreaterThan(0);
      for (const permission of catalog.permissions) {
        expect(catalog.areas.some((area) => permission.startsWith(`${area}.`))).toBe(true);
      }
    });

    it('POST /roles — create()', async () => {
      const response = await call('/roles', {
        method: 'POST',
        body: {
          code: 'CONTRATO_TESTE',
          name: 'Papel do Contrato',
          description: 'Criado pelo teste de contrato.',
          permissions: ['companies.read', 'users.read'],
        },
      });

      expect(response.status).toBe(201);
      const role = response.body as { id: string; isSystem: boolean };
      expect(role.isSystem).toBe(false);
      createdRoleId = role.id;
    });

    it('PATCH /roles/:id — update() sem o campo code', async () => {
      const response = await call(`/roles/${createdRoleId}`, {
        method: 'PATCH',
        body: { name: 'Papel do Contrato (renomeado)', permissions: ['companies.read'] },
      });

      expect(response.status).toBe(200);
      expect((response.body as { permissions: string[] }).permissions).toEqual(['companies.read']);
    });

    it('DELETE /roles/:id — remove() devolve 204 sem corpo', async () => {
      const response = await call(`/roles/${createdRoleId}`, { method: 'DELETE' });

      expect(response.status).toBe(204);
      expect(response.body).toBeNull();
    });
  });

  describe('userService', () => {
    let createdUserId: string;
    let roleId: string;

    beforeAll(async () => {
      const roles = (await call('/roles')).body as { id: string; code: string }[];
      roleId = roles.find((role) => role.code === 'MANAGER')!.id;
    });

    it('GET /users — list()', async () => {
      const response = await call('/users');

      expect(response.status).toBe(200);
      const users = response.body as Record<string, unknown>[];
      expect(users[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          email: expect.any(String),
          phone: expect.any(String),
          roleId: expect.any(String),
          status: expect.any(String),
        }),
      );
      // O que NÃO pode vir. A ausência é a asserção que importa.
      expect(users[0]).not.toHaveProperty('passwordHash');
      expect(users[0]).not.toHaveProperty('password');
    });

    it('POST /users — create() com o telefone só de dígitos que a máscara produz', async () => {
      const response = await call('/users', {
        method: 'POST',
        body: {
          name: 'Usuário do Contrato',
          email: 'usuario-contrato@teste.veertex.local',
          // É o que o `unmask: true` do IMaskInput entrega: DDD + número, sem +55.
          phone: '62999990021',
          password: 'senha-forte-do-contrato',
          roleId,
        },
      });

      expect(response.status).toBe(201);
      const user = response.body as { id: string; phone: string };
      // O backend normaliza para E.164 — e a tela de edição tira o +55 para remontar a máscara.
      expect(user.phone).toBe('+5562999990021');
      createdUserId = user.id;
    });

    it('POST /users recusa telefone vazio', async () => {
      // Regra 9 do CLAUDE.md: sem WhatsApp não há como recuperar a senha.
      const response = await call('/users', {
        method: 'POST',
        body: {
          name: 'Sem Telefone',
          email: 'sem-telefone-contrato@teste.veertex.local',
          phone: '',
          password: 'senha-forte-do-contrato',
          roleId,
        },
      });

      expect(response.status).toBe(400);
    });

    it('PATCH /users/:id — update()', async () => {
      const response = await call(`/users/${createdUserId}`, {
        method: 'PATCH',
        body: { name: 'Usuário do Contrato (editado)' },
      });

      expect(response.status).toBe(200);
      expect((response.body as { name: string }).name).toBe('Usuário do Contrato (editado)');
    });

    it('PATCH /users/:id/status — setActive()', async () => {
      const off = await call(`/users/${createdUserId}/status`, {
        method: 'PATCH',
        body: { active: false },
      });

      expect(off.status).toBe(200);
      expect((off.body as { status: string }).status).toBe('DISABLED');
    });
  });

  describe('proteção', () => {
    it('todos os endpoints de administração exigem token', async () => {
      const paths = ['/companies', '/users', '/roles', '/roles/catalog'];

      for (const path of paths) {
        const response = await call(path, { auth: false });
        expect({ path, status: response.status }).toEqual({ path, status: 401 });
      }
    });
  });
});
