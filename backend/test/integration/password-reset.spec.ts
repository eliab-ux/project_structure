// ⚠️ PRIMEIRO import, obrigatoriamente: aponta EVOLUTION_* para o servidor de mentira antes que o
// AppModule — e o ConfigModule.forRoot() dentro dele — leia o ambiente. Ver o docblock do módulo.
import {
  FAKE_EVOLUTION_APIKEY,
  FAKE_EVOLUTION_INSTANCE,
  FAKE_EVOLUTION_PORT,
} from '../helpers/evolution-test-env';

import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { ConfigService } from '@nestjs/config';
import {
  RequestPasswordResetCommand,
  RequestPasswordResetUseCase,
} from '../../src/contexts/auth/application/use-cases/request-password-reset/request-password-reset.use-case';
import {
  ResetPasswordCommand,
  ResetPasswordUseCase,
} from '../../src/contexts/auth/application/use-cases/reset-password/reset-password.use-case';
import {
  LoginCommand,
  LoginUseCase,
} from '../../src/contexts/auth/application/use-cases/login/login.use-case';
import { EvolutionResetCodeMessenger } from '../../src/infrastructure/whatsapp/evolution-reset-code.messenger';
import { MAX_RESET_CODE_ATTEMPTS } from '../../src/contexts/auth/domain/entities/password-reset-code.entity';
import { FakeEvolution, extractCode, startFakeEvolution } from '../helpers/fake-evolution';
import { UseCaseHarness, createUseCaseHarness } from '../helpers/use-case-harness';
import { runCli } from '../helpers/run-cli';
import { connectAsOwner, deleteAccountsByDocument } from '../helpers/db';
import { cnpjWithCheckDigits } from '../helpers/document';

/**
 * Recuperação de senha por código no WhatsApp — testada ATÉ A FRONTEIRA DO ENVIO.
 *
 * O adapter exercitado é o real (`EvolutionResetCodeMessenger`), com axios saindo pela rede; o que
 * está do outro lado é um Evolution de mentira que registra a requisição. Assim se verifica o que
 * de fato depende de nós — caminho, header, formato do número, texto da mensagem, geração e
 * hashing do código, TTL, tentativas, cota, uso único — e resta pendente apenas o elo que não
 * controlamos: o Evolution de verdade entregar a mensagem.
 *
 * ⚠️ Nenhuma asserção compara o código com o que está no banco. O que está no banco é o HASH, e é
 * essa diferença que um teste precisa provar.
 */

const ACCOUNT = {
  document: cnpjWithCheckDigits('900000070001'),
  name: 'Conta do Reset',
  email: 'reset@teste.veertex.local',
  password: randomBytes(15).toString('base64url'),
  phoneDigits: '5562999990015',
};

describe('Recuperação de senha por WhatsApp — até a fronteira do envio', () => {
  let owner: Client;
  let evolution: FakeEvolution;
  let harness: UseCaseHarness;
  let accountId: string;
  let userId: string;

  /** Limpa os códigos do usuário: a cota é por hora e um bloco não pode gastar a do seguinte. */
  const clearCodes = async () => {
    await owner.query('delete from password_reset_codes where user_id = $1', [userId]);
    evolution.requests.length = 0;
  };

  const request = () =>
    harness.unscoped(() =>
      harness.app
        .get(RequestPasswordResetUseCase)
        .execute(new RequestPasswordResetCommand(ACCOUNT.email, '127.0.0.1')),
    );

  const lastCode = () => extractCode(String(evolution.requests.at(-1)?.body.text ?? ''));

  beforeAll(async () => {
    owner = await connectAsOwner();
    await deleteAccountsByDocument(owner, [ACCOUNT.document]);

    const created = await runCli(
      'create-account.cli.ts',
      [
        '--account-name',
        ACCOUNT.name,
        '--account-document',
        ACCOUNT.document,
        '--plan',
        'COMPLETO',
        '--company-legal-name',
        `${ACCOUNT.name} Ltda`,
        '--company-document',
        ACCOUNT.document,
        '--tax-regime',
        'SIMPLES',
        '--state-registration-exempt',
        '--street',
        'Rua do Reset',
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
        'Admin do Reset',
        '--admin-email',
        ACCOUNT.email,
        '--admin-phone',
        '62999990015',
      ],
      { VEERTEX_ADMIN_PASSWORD: ACCOUNT.password },
    );
    if (created.exitCode !== 0) {
      throw new Error(`Pré-condição falhou:\n${created.output}`);
    }

    const { rows } = await owner.query<{ account_id: string; user_id: string }>(
      `select a.id as account_id, u.id as user_id
         from accounts a join users u on u.account_id = a.id
        where a.document = $1`,
      [ACCOUNT.document],
    );
    accountId = rows[0].account_id;
    userId = rows[0].user_id;

    // As variáveis já foram definidas no import; aqui só se põe o servidor na porta combinada.
    evolution = await startFakeEvolution(FAKE_EVOLUTION_PORT);

    harness = await createUseCaseHarness();
  }, 180_000);

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
    if (evolution) {
      await evolution.close();
    }
    await deleteAccountsByDocument(owner, [ACCOUNT.document]);
    await owner.end();
  });

  describe('o envio', () => {
    beforeAll(async () => {
      await clearCodes();
      await request();
    });

    it('chega ao Evolution no endpoint e com o método certos', () => {
      expect(evolution.requests).toHaveLength(1);
      expect(evolution.requests[0].method).toBe('POST');
      expect(evolution.requests[0].path).toBe(`/message/sendText/${FAKE_EVOLUTION_INSTANCE}`);
    });

    it('autentica com a apikey DA INSTÂNCIA', () => {
      // Menor privilégio: enviar mensagem não exige poder para criar ou apagar instância, e a chave
      // global é a credencial mestra do servidor Evolution inteiro.
      expect(evolution.requests[0].apikey).toBe(FAKE_EVOLUTION_APIKEY);
      expect(evolution.requests[0].headers.authorization).toBeUndefined();
    });

    it('manda o número só com dígitos, como o JID exige', () => {
      expect(evolution.requests[0].body.number).toBe(ACCOUNT.phoneDigits);
    });

    it('manda um código de seis dígitos, sem link', () => {
      const text = String(evolution.requests[0].body.text);
      expect(text).toMatch(/\*\d{6}\*/);
      // Código acompanhado de link é o formato que golpista imita; ensinar o usuário a esperar um
      // torna o golpe real mais fácil.
      expect(text).not.toMatch(/https?:\/\//);
      expect(text).toContain('15 minutos');
    });

    it('grava o HASH, nunca o código', async () => {
      const code = lastCode();
      const { rows } = await owner.query<{ code_hash: string; sent_at: string | null }>(
        'select code_hash, sent_at from password_reset_codes where user_id = $1',
        [userId],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].code_hash).not.toContain(code);
      expect(rows[0].code_hash).toMatch(/^\$2[aby]\$\d{2}\$/);
      // `sentAt` só é escrito depois de o envio ter dado certo.
      expect(rows[0].sent_at).not.toBeNull();
    });
  });

  describe('sem revelar quais contas existem', () => {
    beforeAll(clearCodes);

    it('não lança para e-mail desconhecido, e não envia nada', async () => {
      await expect(
        harness.unscoped(() =>
          harness.app
            .get(RequestPasswordResetUseCase)
            .execute(new RequestPasswordResetCommand('ninguem@teste.veertex.local', null)),
        ),
      ).resolves.toBeUndefined();

      expect(evolution.requests).toHaveLength(0);
    });

    it('recusa antes de olhar o usuário quando o canal não está configurado', () => {
      // Verificado no adapter, e não pelo fluxo, porque o ConfigService congela o ambiente na
      // subida do módulo — derrubar a variável agora não chegaria ao contexto já criado. A ORDEM
      // (canal antes do usuário) está garantida pelo use case, cuja primeira linha é o
      // `ensureAvailable()`; o que se afirma aqui é que ele de fato recusa.
      const semCanal = new EvolutionResetCodeMessenger({
        get: () => undefined,
      } as unknown as ConfigService);

      expect(() => semCanal.ensureAvailable()).toThrow();
    });
  });

  describe('um código vivo por vez', () => {
    beforeAll(clearCodes);

    it('pedir de novo invalida o anterior', async () => {
      await request();
      const primeiro = lastCode();
      await request();
      const segundo = lastCode();

      expect(segundo).not.toBe(primeiro);

      // O primeiro código não abre mais nada — dois códigos válidos dobrariam a superfície de
      // adivinhação.
      await expect(
        harness.unscoped(() =>
          harness.app
            .get(ResetPasswordUseCase)
            .execute(new ResetPasswordCommand(ACCOUNT.email, primeiro, 'nova-senha-1', null)),
        ),
      ).rejects.toThrow();
    });
  });

  describe('cota por hora', () => {
    beforeAll(clearCodes);

    it('para de enviar depois de três pedidos na mesma hora', async () => {
      await request();
      await request();
      await request();
      expect(evolution.requests).toHaveLength(3);

      await request();
      // Sem exceção — o quarto pedido responde igual aos outros —, mas nada sai.
      expect(evolution.requests).toHaveLength(3);
    });
  });

  describe('quando o canal falha', () => {
    beforeAll(clearCodes);

    it('não lança, não marca como enviado e não consome a cota', async () => {
      evolution.failNextWith(500);
      await expect(request()).resolves.toBeUndefined();

      const { rows } = await owner.query<{ sent_at: string | null }>(
        'select sent_at from password_reset_codes where user_id = $1',
        [userId],
      );
      // A cota conta ENVIOS. Contar tentativas faria uma falha de infraestrutura consumir a cota do
      // usuário — ele ficaria sem poder recuperar a senha por causa de um problema que não é dele.
      expect(rows.every((row) => row.sent_at === null)).toBe(true);

      // E o próximo pedido ainda passa.
      await request();
      expect(evolution.requests.at(-1)?.body.text).toMatch(/\*\d{6}\*/);
    });
  });

  describe('consumo do código', () => {
    beforeEach(clearCodes);

    it('troca a senha e o código não serve uma segunda vez', async () => {
      await request();
      const code = lastCode();
      const novaSenha = randomBytes(12).toString('base64url');

      await harness.unscoped(() =>
        harness.app
          .get(ResetPasswordUseCase)
          .execute(new ResetPasswordCommand(ACCOUNT.email, code, novaSenha, null)),
      );

      // A prova de que a senha mudou é o login com ela.
      const session = await harness.unscoped(() =>
        harness.app.get(LoginUseCase).execute(new LoginCommand(ACCOUNT.email, novaSenha, null)),
      );
      expect(session.accountId).toBe(accountId);

      // Uso único.
      await expect(
        harness.unscoped(() =>
          harness.app
            .get(ResetPasswordUseCase)
            .execute(new ResetPasswordCommand(ACCOUNT.email, code, 'outra-senha-qualquer', null)),
        ),
      ).rejects.toThrow();

      ACCOUNT.password = novaSenha;
    });

    it(`morre depois de ${MAX_RESET_CODE_ATTEMPTS} tentativas erradas`, async () => {
      await request();
      const code = lastCode();
      const errado = code === '000000' ? '999999' : '000000';

      for (let attempt = 0; attempt < MAX_RESET_CODE_ATTEMPTS; attempt += 1) {
        await expect(
          harness.unscoped(() =>
            harness.app
              .get(ResetPasswordUseCase)
              .execute(new ResetPasswordCommand(ACCOUNT.email, errado, 'nao-vai-valer', null)),
          ),
        ).rejects.toThrow();
      }

      // O contador tem de estar PERSISTIDO. Esta asserção existe porque a versão anterior deste
      // fluxo incrementava e perdia o incremento: `registerAttempt()` era salvo e o `throw`
      // seguinte derrubava a transação da requisição inteira, levando o `update` junto. O limite
      // de cinco existia no código e não existia no banco.
      const { rows } = await owner.query<{ attempts: number }>(
        'select attempts from password_reset_codes where user_id = $1',
        [userId],
      );
      expect(rows[0].attempts).toBe(MAX_RESET_CODE_ATTEMPTS);

      // Cinco chances transformam 1.000.000 de combinações em 5 — e agora nem o código CERTO abre.
      await expect(
        harness.unscoped(() =>
          harness.app
            .get(ResetPasswordUseCase)
            .execute(new ResetPasswordCommand(ACCOUNT.email, code, 'nao-vai-valer', null)),
        ),
      ).rejects.toThrow();
    });

    it('não aceita código expirado', async () => {
      await request();
      const code = lastCode();

      // Viagem no tempo pelo banco: envelhecer a linha é mais honesto do que mockar o relógio da
      // aplicação, porque o que se quer verificar é a comparação contra `expires_at` como ela roda.
      await owner.query(
        `update password_reset_codes set expires_at = now() - interval '1 minute'
          where user_id = $1`,
        [userId],
      );

      await expect(
        harness.unscoped(() =>
          harness.app
            .get(ResetPasswordUseCase)
            .execute(new ResetPasswordCommand(ACCOUNT.email, code, 'nao-vai-valer', null)),
        ),
      ).rejects.toThrow();
    });
  });
});
