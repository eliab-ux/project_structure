import { createE2EApp, E2EContext } from './e2e-app';
import { seedAccount, SeededAccount, TEST_PASSWORD } from './seed';
import { PASSWORD_RESET_NOTIFIER } from '../../src/contexts/auth/application/ports/output/password-reset-notifier.port';
import type {
  PasswordResetMessage,
  PasswordResetNotifierPort,
} from '../../src/contexts/auth/application/ports/output/password-reset-notifier.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../src/contexts/user/application/ports/output/user-repository.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../src/contexts/user/application/ports/output/password-hasher.port';
import { User } from '../../src/contexts/user/domain/entities/user.entity';
import { AccountId } from '../../src/contexts/account/domain/value-objects/account-id.vo';
import { Email } from '../../src/shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../src/shared/domain/value-objects/phone-e164.vo';

/**
 * Dublê do canal do WhatsApp. Captura o código em vez de enviá-lo — é o único ponto do sistema
 * onde o valor em claro existe, e é assim que o teste consegue exercitar o fluxo inteiro sem
 * mandar mensagem para ninguém.
 */
class FakeNotifier implements PasswordResetNotifierPort {
  configured = true;
  sent: PasswordResetMessage[] = [];
  failNext = false;

  isConfigured(): boolean {
    return this.configured;
  }

  async send(message: PasswordResetMessage): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Evolution indisponível');
    }
    this.sent.push(message);
  }

  get lastCode(): string {
    return this.sent[this.sent.length - 1].code;
  }
}

describe('Recuperação de senha por código no WhatsApp (e2e)', () => {
  jest.setTimeout(120_000);

  let ctx: E2EContext;
  let conta: SeededAccount;
  let notifier: FakeNotifier;

  const request = (email: string) =>
    ctx.inject({ method: 'POST', url: '/api/auth/request-password-reset', payload: { email } });

  const reset = (email: string, code: string, newPassword: string) =>
    ctx.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { email, code, newPassword },
    });

  const login = (email: string, password: string) =>
    ctx.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });

  /**
   * Cria um usuário novo para o teste que o pedir.
   *
   * Não é conveniência: o limite de 3 envios por hora é por usuário e é REAL. Reaproveitar o
   * mesmo e-mail entre testes faria o quarto deles falhar por cota estourada — e o diagnóstico
   * pareceria um bug no fluxo de código, quando é a regra funcionando.
   */
  let sequence = 0;
  async function freshUser(mustChangePassword = false): Promise<string> {
    sequence += 1;
    const email = `alvo.${sequence}@corteceres.com.br`;

    await ctx.runInContext(async () => {
      const users = ctx.app.get<UserRepositoryPort>(USER_REPOSITORY);
      const hasher = ctx.app.get<PasswordHasherPort>(PASSWORD_HASHER);

      await users.save(
        User.create({
          accountId: AccountId.from(conta.accountId),
          name: `Alvo ${sequence}`,
          email: Email.create(email),
          phone: PhoneE164.create('62998708893'),
          passwordHash: await hasher.hash(TEST_PASSWORD),
          role: 'modelista',
          mustChangePassword,
        }),
      );
    });

    return email;
  }

  beforeAll(async () => {
    notifier = new FakeNotifier();
    ctx = await createE2EApp({
      overrides: [{ token: PASSWORD_RESET_NOTIFIER, useValue: notifier }],
    });
    conta = await seedAccount(ctx, 'reset');
  });

  beforeEach(() => {
    notifier.sent = [];
    notifier.configured = true;
    notifier.failNext = false;
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  describe('pedido de código', () => {
    it('responde 204 e envia o código para quem existe', async () => {
      const response = await request(conta.users.modelista.email);

      expect(response.statusCode).toBe(204);
      expect(notifier.sent).toHaveLength(1);
      expect(notifier.lastCode).toMatch(/^\d{6}$/);
    });

    it('responde 204 IGUAL para e-mail inexistente, e não envia nada', async () => {
      const response = await request('ninguem@corteceres.com.br');

      expect(response.statusCode).toBe(204);
      expect(notifier.sent).toHaveLength(0);
    });

    it('responde 204 com o canal fora do ar — a falha não vira oráculo', async () => {
      notifier.configured = false;

      expect((await request(conta.users.modelista.email)).statusCode).toBe(204);
      expect((await request('ninguem@corteceres.com.br')).statusCode).toBe(204);
    });

    it('a mensagem não contém link — código com link é o formato que o golpista imita', async () => {
      await request(conta.users.modelista.email);
      // O texto é montado no adapter; aqui garantimos que o caso de uso não injeta URL no payload.
      expect(JSON.stringify(notifier.sent[0])).not.toMatch(/https?:\/\//);
    });

    it('pedir um código novo invalida o anterior — um só código vivo por usuário', async () => {
      await request(conta.users.admin.email);
      const primeiro = notifier.lastCode;

      await request(conta.users.admin.email);
      const segundo = notifier.lastCode;

      const comAntigo = await reset(conta.users.admin.email, primeiro, 'senha-nova-do-admin');
      expect(comAntigo.statusCode).toBe(400);

      const comNovo = await reset(conta.users.admin.email, segundo, 'senha-nova-do-admin');
      expect(comNovo.statusCode).toBe(204);
    });

    it('limita os ENVIOS por hora, e a falha de envio não consome a cota', async () => {
      const email = conta.users.owner.email;

      notifier.failNext = true;
      await request(email); // falhou no envio: não marca sent_at, não gasta cota

      for (let i = 0; i < 3; i += 1) {
        await request(email);
      }
      expect(notifier.sent).toHaveLength(3);

      // O quarto envio bem-sucedido bate no limite — e ainda assim responde 204.
      const quarto = await request(email);
      expect(quarto.statusCode).toBe(204);
      expect(notifier.sent).toHaveLength(3);
    });
  });

  describe('uso do código', () => {
    it('redefine a senha e a antiga para de valer', async () => {
      const email = await freshUser();
      await request(email);
      const code = notifier.lastCode;

      expect((await reset(email, code, 'senha-redefinida-1')).statusCode).toBe(204);
      expect((await login(email, 'senha-redefinida-1')).statusCode).toBe(200);
      expect((await login(email, TEST_PASSWORD)).statusCode).toBe(401);
    });

    it('não obriga nova troca — quem escolheu a senha foi o próprio usuário', async () => {
      const email = await freshUser(true);
      await request(email);
      await reset(email, notifier.lastCode, 'senha-redefinida-2');

      const session = await login(email, 'senha-redefinida-2');
      expect(session.body.user.mustChangePassword).toBe(false);
    });

    it('é de uso único', async () => {
      const email = await freshUser();
      await request(email);
      const code = notifier.lastCode;

      expect((await reset(email, code, 'senha-redefinida-3')).statusCode).toBe(204);
      expect((await reset(email, code, 'outra-senha-qualquer')).statusCode).toBe(400);
    });

    it('morre na 5ª tentativa errada, mesmo com o código certo em mãos depois', async () => {
      const email = await freshUser();
      await request(email);
      const code = notifier.lastCode;
      const errado = code === '000000' ? '111111' : '000000';

      for (let attempt = 0; attempt < 5; attempt += 1) {
        expect((await reset(email, errado, 'senha-que-nao-vai-valer')).statusCode).toBe(400);
      }

      const comCodigoCerto = await reset(email, code, 'senha-redefinida-4');
      expect(comCodigoCerto.statusCode).toBe(400);
    });

    it('toda recusa devolve a MESMA mensagem — sem oráculo', async () => {
      const inexistente = await reset('ninguem@corteceres.com.br', '123456', 'senha-nova-aqui');
      const semPedido = await reset(conta.users.admin.email, '123456', 'senha-nova-aqui');

      expect(inexistente.statusCode).toBe(400);
      expect(semPedido.statusCode).toBe(400);
      expect(inexistente.body.message).toBe(semPedido.body.message);
    });

    it('recusa código fora do formato de 6 dígitos na validação de entrada', async () => {
      for (const code of ['12345', '1234567', 'abcdef', '']) {
        expect((await reset(conta.users.admin.email, code, 'senha-nova-aqui')).statusCode).toBe(
          400,
        );
      }
    });

    it('recusa senha nova curta antes de olhar o código', async () => {
      expect((await reset(conta.users.admin.email, '123456', 'curta')).statusCode).toBe(400);
    });
  });

  describe('troca de senha autenticada', () => {
    it('exige a senha atual mesmo com token válido', async () => {
      const email = await freshUser();
      const session = await login(email, TEST_PASSWORD);

      const errada = await ctx.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        token: session.body.accessToken,
        payload: { currentPassword: 'senha-que-nao-e-a-atual', newPassword: 'nova-senha-boa' },
      });
      expect(errada.statusCode).toBe(401);

      const certa = await ctx.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        token: session.body.accessToken,
        payload: { currentPassword: TEST_PASSWORD, newPassword: 'nova-senha-boa' },
      });
      expect(certa.statusCode).toBe(204);
      expect((await login(email, 'nova-senha-boa')).statusCode).toBe(200);
      expect((await login(email, TEST_PASSWORD)).statusCode).toBe(401);
    });

    it('limpa a obrigação de trocar no primeiro login', async () => {
      const email = await freshUser(true);

      const primeiraSessao = await login(email, TEST_PASSWORD);
      expect(primeiraSessao.body.user.mustChangePassword).toBe(true);

      const troca = await ctx.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        token: primeiraSessao.body.accessToken,
        payload: { currentPassword: TEST_PASSWORD, newPassword: 'senha-escolhida-por-mim' },
      });
      expect(troca.statusCode).toBe(204);

      const segundaSessao = await login(email, 'senha-escolhida-por-mim');
      expect(segundaSessao.body.user.mustChangePassword).toBe(false);
    });
  });
});
