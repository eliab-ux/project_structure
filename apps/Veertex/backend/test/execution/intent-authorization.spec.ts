// ⚠️ PRIMEIRO import: escolhe o tradutor determinístico antes que o ConfigModule leia o ambiente.
// Mesmo motivo do `evolution-test-env.ts` — os imports são içados e o AppModule carrega o
// ConfigModule.forRoot() junto, então definir a variável num beforeAll chega tarde.
import '../helpers/intent-test-env';

import { randomBytes, randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { Client } from 'pg';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/create-app';
import { expectCliSuccess, runCli } from '../helpers/run-cli';
import { connectAsOwner, deleteAccountsByDocument } from '../helpers/db';
import { cnpjWithCheckDigits } from '../helpers/document';

/*
 * 120s para ESTE arquivo — corrigido em 15/08/2026, na terceira ocorrência de "falhou por carga da
 * máquina" (ADR-0003).
 *
 * O teto global de 30s do `jest.config.ts` foi escolhido para query de banco, e nunca foi um limite
 * pensado para `spawn` de CLI: subir o Nest inteiro via `ts-node` leva ~12s em máquina ociosa e passa
 * de 30s com um build concorrendo. Falhava por um limite que não media nada de útil, e a mensagem
 * apontava para o `beforeAll` em vez do comando que travou.
 *
 * Isto NÃO é afrouxar a detecção: o `runCli` ganhou teto PRÓPRIO de 90s, com o nome do script na
 * mensagem. Quem falha primeiro agora é quem sabe explicar o que aconteceu. O global de 30s continua
 * valendo para todos os outros arquivos, que é onde ele faz sentido.
 */
jest.setTimeout(120_000);

/**
 * **A IA não é caminho paralelo de autorização.**
 *
 * É o §8 da especificação de frontend, e este arquivo existe para que ele seja verificável em vez de
 * prometido: *"Comando emitido pelo modelo passa pelos mesmos guards que um clique. Se o papel não
 * pode alterar permissões, pedir por voz também não pode."*
 *
 * O ataque que o teste monta é o realista: um usuário **autenticado e legítimo**, cujo papel NÃO tem
 * `roles.update`, tenta alterar as permissões de um papel pela rota de intenção. Ele tem token válido,
 * conhece o id do papel, e o corpo da requisição é bem-formado. Se a rota de intenção tivesse
 * autorização própria — ou nenhuma —, isto seria escalada de privilégio com uma requisição.
 *
 * Roda pela camada HTTP inteira, via `createApp()`, e não pelo Use Case direto: o que se quer provar é
 * que a ROTA recusa, com o mesmo status que o caminho de clique daria. Testar o Use Case provaria
 * menos — o controller poderia ter esquecido de passar as permissões do token, e o teste passaria.
 *
 * O último bloco cobre o DISPATCH de empresa, que compartilha a mesma fixture (conta, admin, token).
 * Está aqui e não em arquivo próprio porque montar outra conta custaria mais doze segundos de spawn
 * para exercitar o mesmo servidor.
 */

const ACCOUNT = {
  document: cnpjWithCheckDigits('900000120001'),
  adminEmail: 'intent-admin@teste.veertex.local',
  adminPassword: randomBytes(15).toString('base64url'),
};

/** Usuário SEM `roles.update`: papel CASHIER, que o onboarding cria com permissões de caixa. */
const CASHIER = {
  email: 'intent-caixa@teste.veertex.local',
  password: randomBytes(15).toString('base64url'),
};

describe('Intenção não é caminho paralelo de autorização (§8)', () => {
  let owner: Client;
  let app: NestFastifyApplication;
  let baseUrl: string;

  let adminToken: string;
  let cashierToken: string;
  let managerRoleId: string;

  const call = async (
    path: string,
    init: { method?: string; body?: unknown; token?: string } = {},
  ): Promise<{ status: number; body: Record<string, unknown> | null }> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };

  const login = async (email: string, password: string): Promise<string> => {
    const response = await call('/auth/login', { method: 'POST', body: { email, password } });
    if (response.status !== 200) {
      throw new Error(
        `Login de ${email} falhou: ${response.status} ${JSON.stringify(response.body)}`,
      );
    }
    return (response.body as { accessToken: string }).accessToken;
  };

  beforeAll(async () => {
    owner = await connectAsOwner();
    await deleteAccountsByDocument(owner, [ACCOUNT.document]);

    const created = await runCli(
      'create-account.cli.ts',
      [
        '--account-name',
        'Conta da Intencao',
        '--account-document',
        ACCOUNT.document,
        '--plan',
        'COMPLETO',
        '--company-legal-name',
        'Conta da Intencao Ltda',
        '--company-document',
        ACCOUNT.document,
        '--tax-regime',
        'SIMPLES',
        '--state-registration-exempt',
        '--street',
        'Rua da Intencao',
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
        'Admin da Intencao',
        '--admin-email',
        ACCOUNT.adminEmail,
        '--admin-phone',
        '62999990060',
      ],
      { VEERTEX_ADMIN_PASSWORD: ACCOUNT.adminPassword },
    );
    expectCliSuccess(created, 'create:account (conta da intenção)');

    app = await createApp();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api`;

    adminToken = await login(ACCOUNT.adminEmail, ACCOUNT.adminPassword);

    const roles = (await call('/roles', { token: adminToken })).body as unknown as {
      id: string;
      code: string;
      permissions: string[];
    }[];
    managerRoleId = roles.find((role) => role.code === 'MANAGER')!.id;
    const cashierRole = roles.find((role) => role.code === 'CASHIER')!;

    // A pré-condição do teste, afirmada e não suposta: se o CASHIER ganhasse `roles.update` num
    // ajuste futuro do seed, o teste passaria por motivo errado — provaria que quem NÃO pode não
    // consegue, usando um papel que pode.
    expect(cashierRole.permissions).not.toContain('*');
    expect(cashierRole.permissions).not.toContain('roles.update');
    expect(cashierRole.permissions).not.toContain('roles.*');

    const cashier = await call('/users', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Operador de Caixa',
        email: CASHIER.email,
        phone: '62999990061',
        password: CASHIER.password,
        roleId: cashierRole.id,
      },
    });
    expect(cashier.status).toBe(201);

    cashierToken = await login(CASHIER.email, CASHIER.password);
  }, 240_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await deleteAccountsByDocument(owner, [ACCOUNT.document]);
    await owner.end();
  });

  describe('o ataque: alterar permissões sem ter roles.update', () => {
    it('POST /intent/approve recusa com 403', async () => {
      const response = await call('/intent/approve', {
        method: 'POST',
        token: cashierToken,
        body: {
          draftId: randomUUID(),
          command: 'SetRolePermissions',
          fields: {
            roleId: { value: managerRoleId, origin: 'ditado', review: false },
            permissions: { value: ['*'], origin: 'ditado', review: false },
          },
        },
      });

      expect(response.status).toBe(403);
      // A mensagem nomeia a AÇÃO, nunca a permissão interna: `roles.update` não significa nada para o
      // operador, e vazar o vocabulário de permissões ajuda quem está sondando.
      expect(String(response.body?.message)).toMatch(/não permite/i);
      expect(JSON.stringify(response.body)).not.toContain('roles.update');
    });

    it('e o papel continua intacto no banco — a recusa aconteceu ANTES de qualquer escrita', async () => {
      const { rows } = await owner.query<{ permissions: unknown }>(
        'select permissions from roles where id = $1',
        [managerRoleId],
      );

      // O ataque pedia `['*']`. Se a permissão total tivesse entrado, este é o assert que grita.
      const permissions = rows[0].permissions as string[];
      expect(permissions).not.toContain('*');
    });

    it('POST /intent/draft também recusa — o impedimento aparece antes do rascunho', async () => {
      // §3: módulo inativo nunca é proposto; a mesma lógica vale para comando sem permissão. Montar o
      // rascunho e recusar só na aprovação exibiria ao operador o trabalho pronto de algo que ele não
      // pode fazer.
      const response = await call('/intent/draft', {
        method: 'POST',
        token: cashierToken,
        body: {
          command: 'SetRolePermissions',
          fields: { roleId: { value: managerRoleId, origin: 'ditado', review: false } },
        },
      });

      expect(response.status).toBe(403);
    });

    it('POST /intent nem propõe o comando para quem não pode executá-lo', async () => {
      // Conveniência, não segurança (§8: "esconder não é proteger"). A proteção são os dois testes
      // acima; este verifica que o operador não é treinado a colecionar recusas.
      const response = await call('/intent', {
        method: 'POST',
        token: cashierToken,
        body: { text: 'a Ana pode vender mas não pode mexer em preço' },
      });

      expect(response.status).toBe(200);
      // O texto casaria com `SetRolePermissions` no tradutor determinístico — e não casa, porque o
      // comando não está entre os disponíveis para este papel.
      expect(response.body?.command).not.toBe('SetRolePermissions');
    });
  });

  describe('o contraste: o mesmo pedido, por quem PODE', () => {
    it('o admin executa o mesmo comando com 200', async () => {
      // Sem este teste, os quatro acima passariam com uma rota quebrada que recusa todo mundo — e um
      // gate que recusa sempre é indistinguível de um gate que funciona.
      const response = await call('/intent/approve', {
        method: 'POST',
        token: adminToken,
        body: {
          draftId: randomUUID(),
          command: 'SetRolePermissions',
          fields: {
            roleId: { value: managerRoleId, origin: 'ditado', review: false },
            permissions: {
              value: ['companies.read', 'users.read'],
              origin: 'ditado',
              review: false,
            },
          },
        },
      });

      expect(response.status).toBe(200);
      expect(String(response.body?.summary)).toMatch(/atualizadas/i);
    });

    it('e a alteração chegou ao banco', async () => {
      const { rows } = await owner.query<{ permissions: unknown }>(
        'select permissions from roles where id = $1',
        [managerRoleId],
      );
      expect(rows[0].permissions as string[]).toEqual(
        expect.arrayContaining(['companies.read', 'users.read']),
      );
    });
  });

  describe('dispatch de empresa por intenção', () => {
    const EXTRA_DOCUMENT = cnpjWithCheckDigits('900000130001');

    afterAll(async () => {
      await deleteAccountsByDocument(owner, [EXTRA_DOCUMENT]);
    });

    it('CreateCompany executa e a empresa aparece na listagem', async () => {
      // O comando estava no catálogo e recusava na execução — comando reconhecido e não executável é
      // dívida (§10). Este teste é o que impede a recusa de voltar por engano.
      const response = await call('/intent/approve', {
        method: 'POST',
        token: adminToken,
        body: {
          draftId: randomUUID(),
          command: 'CreateCompany',
          fields: {
            legalName: { value: 'Filial por Intencao Ltda', origin: 'ditado', review: false },
            document: { value: EXTRA_DOCUMENT, origin: 'ditado', review: false },
            taxRegime: { value: 'SIMPLES', origin: 'ditado', review: false },
            stateRegistrationExempt: { value: true, origin: 'ditado', review: false },
            address: {
              value: {
                street: 'Rua Nova',
                number: '10',
                district: 'Centro',
                city: 'Goiania',
                state: 'GO',
                zipCode: '74000000',
              },
              origin: 'ditado',
              review: false,
            },
          },
        },
      });

      expect(response.status).toBe(200);
      expect(String(response.body?.summary)).toMatch(/cadastrada/i);

      const companies = (await call('/companies', { token: adminToken })).body as unknown as {
        document: string;
      }[];
      expect(companies.map((company) => company.document)).toContain(EXTRA_DOCUMENT);
    });

    it('endereço incompleto recusa nomeando a PARTE que falta, não só "address"', async () => {
      // Dizer apenas "address" mandaria o operador procurar qual das oito partes está vazia.
      const response = await call('/intent/approve', {
        method: 'POST',
        token: adminToken,
        body: {
          draftId: randomUUID(),
          command: 'CreateCompany',
          fields: {
            legalName: { value: 'Sem Endereco Ltda', origin: 'ditado', review: false },
            document: {
              value: cnpjWithCheckDigits('900000140001'),
              origin: 'ditado',
              review: false,
            },
            taxRegime: { value: 'SIMPLES', origin: 'ditado', review: false },
            stateRegistrationExempt: { value: true, origin: 'ditado', review: false },
            address: { value: { street: 'Rua Sem Fim' }, origin: 'ditado', review: false },
          },
        },
      });

      expect(response.status).toBe(400);
      const message = String(response.body?.message);
      expect(message).toContain('address.city');
      expect(message).toContain('address.zipCode');
    });

    it('UpdateCompany por intenção altera a razão social', async () => {
      const companies = (await call('/companies', { token: adminToken })).body as unknown as {
        id: string;
        document: string;
      }[];
      const target = companies.find((company) => company.document === EXTRA_DOCUMENT)!;

      const response = await call('/intent/approve', {
        method: 'POST',
        token: adminToken,
        body: {
          draftId: randomUUID(),
          command: 'UpdateCompany',
          fields: {
            companyId: { value: target.id, origin: 'ditado', review: false },
            legalName: { value: 'Filial Renomeada Ltda', origin: 'ajustado', review: false },
          },
        },
      });

      expect(response.status).toBe(200);
      expect(String(response.body?.summary)).toMatch(/atualizada/i);
    });
  });

  describe('outras recusas do mesmo desenho', () => {
    it('rota de intenção sem token responde 401', async () => {
      const response = await call('/intent', { method: 'POST', body: { text: 'qualquer coisa' } });
      expect(response.status).toBe(401);
    });

    it('comando fora do catálogo é recusado pelo DTO, não pelo dispatch', async () => {
      const response = await call('/intent/approve', {
        method: 'POST',
        token: adminToken,
        body: { draftId: randomUUID(), command: 'DeleteAllCompanies', fields: {} },
      });

      // 400 e não 403: é corpo inválido, e a diferença importa — 403 diria que o comando existe e
      // que falta permissão, o que é informação sobre o catálogo.
      expect(response.status).toBe(400);
    });

    it('campo obrigatório ausente recusa nomeando o que falta, sem inventar padrão', async () => {
      const response = await call('/intent/approve', {
        method: 'POST',
        token: adminToken,
        body: {
          draftId: randomUUID(),
          command: 'SetRolePermissions',
          fields: { roleId: { value: managerRoleId, origin: 'ditado', review: false } },
        },
      });

      expect(response.status).toBe(400);
      expect(String(response.body?.message)).toContain('permissions');
    });
  });
});
