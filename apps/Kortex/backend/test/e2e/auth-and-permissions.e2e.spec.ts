import { createE2EApp, E2EContext } from './e2e-app';
import { seedAccount, SeededAccount, TEST_PASSWORD } from './seed';
import {
  PHONE_CHANGE_AUDIT_REPOSITORY,
  PhoneChangeAuditRepositoryPort,
} from '../../src/contexts/user/application/ports/output/phone-change-audit-repository.port';
import { AccountId } from '../../src/contexts/account/domain/value-objects/account-id.vo';
import { UserId } from '../../src/contexts/user/domain/value-objects/user-id.vo';

/**
 * Prova o Definition of Done da Fase 1:
 *
 *   - login funcional para os três papéis, com `sub`, `role` e `accountId` no token;
 *   - rota protegida sem token = 401; papel errado = 403;
 *   - nenhum dado atravessa a fronteira entre contas.
 *
 * Roda contra o banco `kortex_test`, com o schema recriado pelas migrations reais.
 */
describe('Autenticação e permissões (e2e)', () => {
  jest.setTimeout(120_000);

  let ctx: E2EContext;
  let alfa: SeededAccount;
  let beta: SeededAccount;
  const tokens: Record<string, string> = {};

  async function login(email: string, password = TEST_PASSWORD) {
    return ctx.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  }

  beforeAll(async () => {
    ctx = await createE2EApp();
    alfa = await seedAccount(ctx, 'alfa');
    beta = await seedAccount(ctx, 'beta');

    for (const role of ['owner', 'admin', 'modelista'] as const) {
      const response = await login(alfa.users[role].email);
      tokens[role] = response.body.accessToken;
    }
    tokens.betaOwner = (await login(beta.users.owner.email)).body.accessToken;
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  describe('login', () => {
    it.each(['owner', 'admin', 'modelista'] as const)('autentica o papel %s', async (role) => {
      const response = await login(alfa.users[role].email);

      expect(response.statusCode).toBe(200);
      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.refreshToken).toEqual(expect.any(String));
      expect(response.body.user).toMatchObject({ role, accountId: alfa.accountId });
    });

    it('leva sub, role e accountId ao request.user — conferido pelo /me', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/auth/me',
        token: tokens.admin,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: alfa.users.admin.id,
        role: 'admin',
        accountId: alfa.accountId,
      });
    });

    it('nunca devolve hash de senha em resposta alguma', async () => {
      const response = await login(alfa.users.owner.email);
      const serialized = JSON.stringify(response.body);

      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('$2a$');
      expect(serialized).not.toContain('$2b$');
    });

    it('responde igual para senha errada e e-mail inexistente — sem oráculo de enumeração', async () => {
      const senhaErrada = await login(alfa.users.admin.email, 'senha-completamente-errada');
      const emailInexistente = await login('ninguem@corteceres.com.br');

      expect(senhaErrada.statusCode).toBe(401);
      expect(emailInexistente.statusCode).toBe(401);
      expect(senhaErrada.body.message).toBe(emailInexistente.body.message);
    });

    it('recusa usuário inativo com a mesma resposta', async () => {
      const created = await ctx.inject({
        method: 'POST',
        url: '/api/users',
        token: tokens.owner,
        payload: {
          name: 'Desligado da Silva',
          email: 'desligado@corteceres.com.br',
          phone: '62998708893',
          role: 'modelista',
          initialPassword: TEST_PASSWORD,
        },
      });
      expect(created.statusCode).toBe(201);

      await ctx.inject({
        method: 'PATCH',
        url: `/api/users/${created.body.id}/active`,
        token: tokens.owner,
        payload: { isActive: false },
      });

      const response = await login('desligado@corteceres.com.br');
      expect(response.statusCode).toBe(401);
    });
  });

  describe('401 — rota protegida sem token', () => {
    it.each([
      ['GET', '/api/auth/me'],
      ['GET', '/api/users'],
      ['GET', '/api/machines'],
      ['GET', '/api/account'],
      ['GET', '/api/account/business-hours'],
    ])('%s %s sem token', async (method, url) => {
      const response = await ctx.inject({ method: method as 'GET', url });
      expect(response.statusCode).toBe(401);
    });

    it('recusa token com assinatura forjada', async () => {
      const [header, payload] = tokens.admin.split('.');
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/users',
        token: `${header}.${payload}.assinatura-invalida`,
      });
      expect(response.statusCode).toBe(401);
    });

    it('não aceita o refresh token no lugar do access token', async () => {
      const session = await login(alfa.users.admin.email);
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/users',
        token: session.body.refreshToken,
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('403 — papel errado', () => {
    it('modelista não alcança a equipe', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/users',
        token: tokens.modelista,
      });
      expect(response.statusCode).toBe(403);
    });

    it('modelista não alcança máquinas — o DTO carrega preço, e ele nunca vê dinheiro', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/machines',
        token: tokens.modelista,
      });
      expect(response.statusCode).toBe(403);
    });

    it('admin lê a configuração mas não a altera (janelas são do dono)', async () => {
      const leitura = await ctx.inject({ method: 'GET', url: '/api/account', token: tokens.admin });
      expect(leitura.statusCode).toBe(200);

      const escrita = await ctx.inject({
        method: 'POST',
        url: '/api/account/business-hours',
        token: tokens.admin,
        payload: { weekday: 1, startsAt: '07:00', endsAt: '11:30' },
      });
      expect(escrita.statusCode).toBe(403);
    });

    it('admin não cadastra máquina nem define preço', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/machines',
        token: tokens.admin,
        payload: { name: 'Máquina 02', model: null, hourPriceCents: 8500 },
      });
      expect(response.statusCode).toBe(403);
    });

    it('admin não cria usuário de papel owner — regra dentro do use case, não no guard', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/users',
        token: tokens.admin,
        payload: {
          name: 'Dono Fabricado',
          email: 'fabricado@corteceres.com.br',
          phone: '62998708893',
          role: 'owner',
          initialPassword: TEST_PASSWORD,
        },
      });
      expect(response.statusCode).toBe(403);
    });

    it('admin cria modelista normalmente', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/users',
        token: tokens.admin,
        payload: {
          name: 'Novo Modelista',
          email: 'novo.modelista@corteceres.com.br',
          phone: '(62) 9 9713-2244',
          role: 'modelista',
          initialPassword: TEST_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({
        role: 'modelista',
        // Criado por outra pessoa: nasce obrigado a trocar a senha.
        mustChangePassword: true,
        phone: '+5562997132244',
      });
      expect(Object.keys(response.body)).not.toContain('passwordHash');
    });
  });

  describe('telefone — a porta dos fundos da recuperação de senha (§6.12)', () => {
    async function criarAlvo(sufixo: string) {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/users',
        token: tokens.owner,
        payload: {
          name: `Alvo ${sufixo}`,
          email: `alvo.${sufixo}@corteceres.com.br`,
          phone: '62998708893',
          role: 'modelista',
          initialPassword: TEST_PASSWORD,
        },
      });
      return response.body;
    }

    const editar = (id: string, token: string, payload: Record<string, unknown>) =>
      ctx.inject({ method: 'PUT', url: `/api/users/${id}`, token, payload });

    it('admin NÃO altera o telefone de outro usuário', async () => {
      const alvo = await criarAlvo('admin-tenta');

      const response = await editar(alvo.id, tokens.admin, {
        name: alvo.name,
        email: alvo.email,
        phone: '62911112222',
        role: 'modelista',
      });

      expect(response.statusCode).toBe(403);
    });

    it('admin continua editando nome, e-mail e papel de quem não é dono', async () => {
      const alvo = await criarAlvo('admin-edita');

      const response = await editar(alvo.id, tokens.admin, {
        name: 'Nome Corrigido',
        email: alvo.email,
        // Mesmo telefone: não é alteração, então não esbarra na regra.
        phone: alvo.phone,
        role: 'admin',
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({ name: 'Nome Corrigido', role: 'admin' });
    });

    it('owner altera o telefone de outro usuário e a troca vira trilha', async () => {
      const alvo = await criarAlvo('owner-altera');

      const response = await editar(alvo.id, tokens.owner, {
        name: alvo.name,
        email: alvo.email,
        phone: '(62) 91111-2222',
        role: 'modelista',
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.phone).toBe('+5562911112222');

      const trilha = await ctx.runInContext(async () => {
        const repo = ctx.app.get<PhoneChangeAuditRepositoryPort>(PHONE_CHANGE_AUDIT_REPOSITORY);
        return repo.listByUser(AccountId.from(alfa.accountId), UserId.from(alvo.id));
      });

      expect(trilha).toHaveLength(1);
      expect(trilha[0].previousPhone.value).toBe('+5562998708893');
      expect(trilha[0].newPhone.value).toBe('+5562911112222');
      expect(trilha[0].changedByUserId.value).toBe(alfa.users.owner.id);
      expect(trilha[0].createdAt).toBeInstanceOf(Date);
    });

    it('qualquer papel altera o PRÓPRIO telefone — inclusive o modelista', async () => {
      const response = await ctx.inject({
        method: 'PATCH',
        url: '/api/auth/me/phone',
        token: tokens.modelista,
        payload: { phone: '(62) 93333-4444' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.phone).toBe('+5562933334444');
    });

    it('a troca do próprio telefone NÃO gera trilha — não há terceiro a reconstruir', async () => {
      const trilha = await ctx.runInContext(async () => {
        const repo = ctx.app.get<PhoneChangeAuditRepositoryPort>(PHONE_CHANGE_AUDIT_REPOSITORY);
        return repo.listByUser(
          AccountId.from(alfa.accountId),
          UserId.from(alfa.users.modelista.id),
        );
      });

      expect(trilha).toHaveLength(0);
    });

    it('a rota do próprio telefone não aceita alvo — o alvo vem do token', async () => {
      const response = await ctx.inject({
        method: 'PATCH',
        url: '/api/auth/me/phone',
        token: tokens.modelista,
        payload: { phone: '62933334444', userId: alfa.users.admin.id },
      });

      // forbidNonWhitelisted: o campo a mais derruba a requisição inteira.
      expect(response.statusCode).toBe(400);
    });

    it('recusa telefone inválido', async () => {
      const response = await ctx.inject({
        method: 'PATCH',
        url: '/api/auth/me/phone',
        token: tokens.admin,
        payload: { phone: '123' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('isolamento entre contas', () => {
    it('a listagem de máquinas só traz as da própria conta', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/machines',
        token: tokens.owner,
      });

      const ids = response.body.map((machine: { id: string }) => machine.id);
      expect(ids).toContain(alfa.machineId);
      expect(ids).not.toContain(beta.machineId);
    });

    it('não altera máquina de outra conta nem com o id em mãos — 404, não 403', async () => {
      const response = await ctx.inject({
        method: 'PUT',
        url: `/api/machines/${beta.machineId}`,
        token: tokens.owner,
        payload: { name: 'Sequestrada', model: null, hourPriceCents: 100, isActive: true },
      });

      // 404 e não 403 de propósito: 403 confirmaria que o id existe em alguma conta.
      expect(response.statusCode).toBe(404);
    });

    it('a equipe de uma conta não aparece na outra', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/users',
        token: tokens.betaOwner,
      });

      const emails = response.body.map((user: { email: string }) => user.email);
      expect(emails).toContain(beta.users.admin.email);
      expect(emails).not.toContain(alfa.users.admin.email);
    });
  });

  describe('validação de entrada', () => {
    it('recusa campo não declarado no DTO (forbidNonWhitelisted)', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: alfa.users.admin.email, password: TEST_PASSWORD, role: 'owner' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('recusa senha inicial curta', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/users',
        token: tokens.owner,
        payload: {
          name: 'Senha Curta',
          email: 'curta@corteceres.com.br',
          phone: '62998708893',
          role: 'admin',
          initialPassword: '1234',
        },
      });
      expect(response.statusCode).toBe(400);
    });

    it('recusa e-mail repetido com 400 tratado, não com erro de banco', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/users',
        token: tokens.owner,
        payload: {
          name: 'Repetido',
          email: alfa.users.admin.email,
          phone: '62998708893',
          role: 'admin',
          initialPassword: TEST_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Já existe um usuário com este e-mail.');
    });
  });

  describe('erros internos não vazam', () => {
    it('rota inexistente responde 404 controlado', async () => {
      const response = await ctx.inject({ method: 'GET', url: '/api/nao-existe' });
      expect(response.statusCode).toBe(404);
      expect(JSON.stringify(response.body)).not.toMatch(/at .*\.ts:|node_modules|select .* from/i);
    });
  });
});
