// ⚠️ PRIMEIRO import, obrigatoriamente: encurta a escada antes que o ConfigModule leia o ambiente.
import {
  THROTTLE_BASE_MS,
  THROTTLE_IP_LIMIT,
  THROTTLE_MAX_MS,
} from '../helpers/login-throttle-test-env';

import { randomBytes, randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { Client } from 'pg';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/create-app';
import {
  LoginCommand,
  LoginUseCase,
} from '../../src/contexts/auth/application/use-cases/login/login.use-case';
import {
  LOGIN_THROTTLE,
  LoginThrottlePort,
} from '../../src/contexts/auth/application/ports/output/login-throttle.port';
import { UseCaseHarness, createUseCaseHarness } from '../helpers/use-case-harness';
import { runCli } from '../helpers/run-cli';
import { connectAsOwner, deleteAccountsByDocument } from '../helpers/db';
import { cnpjWithCheckDigits } from '../helpers/document';

/**
 * Proteção do login contra força bruta — as duas camadas.
 *
 * DECIDIDO (Eliab, 11/08/2026). Antes disto o login não tinha limite NENHUM: nem teto por origem,
 * nem contagem por credencial, nem atraso. Era o buraco maior do sistema — o código de recuperação,
 * de seis dígitos e quinze minutos, tinha teto de cinco tentativas; a senha, que vale mais e não
 * expira, tinha infinitas.
 *
 * O teste que mais importa aqui é o de **equivalência de tempo**. Atraso por credencial é a forma
 * mais fácil de criar um oráculo de enumeração sem perceber: se só e-mails cadastrados atrasassem, o
 * cronômetro passaria a responder "esta conta existe" — e desfaria o desenho que o resto do login
 * mantém a custo (mesma exceção, mesma mensagem, comparação contra hash falso para igualar o tempo).
 */

const ACCOUNT = {
  document: cnpjWithCheckDigits('900000110001'),
  email: 'throttle@teste.veertex.local',
  password: randomBytes(15).toString('base64url'),
};

/** IP distinto por bloco: o teto por IP é estado compartilhado do processo. */
const ip = (suffix: number) => `203.0.113.${suffix}`;

/** E-mail distinto por bloco, pelo mesmo motivo — a escada é por credencial. */
const strangerEmail = () => `desconhecido-${randomUUID()}@teste.veertex.local`;

/**
 * Guardada no carregamento do módulo, antes de qualquer boot.
 *
 * O bootstrap do banco APAGA `DATABASE_URL_MIGRATIONS` de `process.env` depois de usá-la — defesa em
 * profundidade para não deixar uma credencial capaz de DDL disponível em memória pelo resto da vida
 * do processo. Em produção isso é irrelevante, porque o processo sobe a aplicação uma vez. Neste
 * spec, não: o harness de use case sobe o AppModule, e depois o bloco HTTP sobe o servidor com
 * `createApp()`. O segundo boot não encontrava a variável e abortava exigindo-a.
 */
const OWNER_URL_AT_LOAD = process.env.DATABASE_URL_MIGRATIONS;

describe('Proteção do login contra força bruta', () => {
  let owner: Client;
  let harness: UseCaseHarness;
  /**
   * Uma tentativa de CONTROLE: credencial nova, sem atraso nenhum, medida AGORA.
   *
   * Toda asserção de tempo neste arquivo compara medições feitas lado a lado, e nunca contra um piso
   * medido uma vez no começo. As duas tentativas de fazer isso com um piso fixo falharam por motivos
   * opostos, e é o que ensina a regra:
   *
   *  - piso medido na PRIMEIRA tentativa do processo → inflado (bcrypt frio, pool abrindo, plano de
   *    query sendo montado), e a diferença medida virava NEGATIVA;
   *  - piso medido com aquecimento, no início do spec → **deriva**. A máquina esquenta, as tentativas
   *    seguintes ficam mais rápidas, e `elapsed - piso` subestima o atraso. Reprovou com 659 onde
   *    esperava 720, sem defeito nenhum.
   *
   * O custo do trabalho varia ao longo da suíte; o atraso não. Medir o controle junto elimina a
   * variável.
   *
   * MÍNIMO de duas amostras, e não uma: cada tentativa carrega ~200ms de variação, e um controle
   * ruidoso contamina toda diferença calculada a partir dele. O mínimo aproxima o PISO do custo do
   * trabalho, que é o que se quer subtrair.
   */
  const control = async (fromA: string, fromB: string) => {
    const first = await attempt(strangerEmail(), 'errada', fromA);
    const second = await attempt(strangerEmail(), 'errada', fromB);
    return { elapsed: Math.min(first.elapsed, second.elapsed) };
  };

  /**
   * Zera a escada de uma credencial. A escada é estado do PROCESSO, compartilhado entre os testes:
   * sem isto, as falhas que um teste deixou fazem o próximo pagar um degrau mais alto, e a
   * comparação de tempo entre duas credenciais compara históricos diferentes. Foi exatamente o que
   * produziu uma diferença de 920ms na primeira execução deste arquivo — no teste, não no produto.
   */
  const resetLadder = (email: string) =>
    harness.app.get<LoginThrottlePort>(LOGIN_THROTTLE).registerSuccess(email);

  /** Uma tentativa de login, com o tempo que ela levou. */
  const attempt = async (
    email: string,
    password: string,
    fromIp: string,
  ): Promise<{ elapsed: number; error: Error | null }> => {
    const startedAt = Date.now();
    const error = await harness
      .unscoped(() =>
        harness.app.get(LoginUseCase).execute(new LoginCommand(email, password, fromIp)),
      )
      .then(() => null)
      .catch((caught: Error) => caught);
    return { elapsed: Date.now() - startedAt, error };
  };

  beforeAll(async () => {
    owner = await connectAsOwner();
    await deleteAccountsByDocument(owner, [ACCOUNT.document]);

    const created = await runCli(
      'create-account.cli.ts',
      [
        '--account-name',
        'Conta do Throttle',
        '--account-document',
        ACCOUNT.document,
        '--plan',
        'COMPLETO',
        '--company-legal-name',
        'Conta do Throttle Ltda',
        '--company-document',
        ACCOUNT.document,
        '--tax-regime',
        'SIMPLES',
        '--state-registration-exempt',
        '--street',
        'Rua do Throttle',
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
        'Admin do Throttle',
        '--admin-email',
        ACCOUNT.email,
        '--admin-phone',
        '62999990040',
      ],
      { VEERTEX_ADMIN_PASSWORD: ACCOUNT.password },
    );
    if (created.exitCode !== 0) {
      throw new Error(`Pré-condição falhou:\n${created.output}`);
    }

    harness = await createUseCaseHarness();

    // Aquecimento: a primeira tentativa do processo é de longe a mais lenta, e deixá-la dentro de um
    // teste faria a medição dele descrever o aquecimento em vez do atraso. IP diferente por
    // tentativa, senão as últimas baterian no teto da camada 1.
    for (let i = 0; i < 3; i += 1) {
      await attempt(strangerEmail(), 'errada', `203.0.113.${200 + i}`);
    }
  }, 180_000);

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
    await deleteAccountsByDocument(owner, [ACCOUNT.document]);
    await owner.end();
  });

  describe('camada 2 — atraso progressivo por credencial', () => {
    it('dobra a cada falha e para no teto', async () => {
      const email = strangerEmail();
      const from = ip(10);

      // 1ª tentativa: nenhuma falha anterior, nenhum atraso — só o custo do trabalho. Serve de
      // controle para as seguintes, medido no mesmo instante da suíte.
      const first = await attempt(email, 'errada', from);
      expect(first.error).toBeInstanceOf(Error);

      // Cada degrau é medido contra o ANTERIOR, não contra um piso fixo, porque o custo do trabalho
      // deriva ao longo da suíte e o atraso não.
      //
      // Com a configuração do teste (BASE, teto = 2 × BASE) a escada tem exatamente três estados:
      //   1ª falha → BASE        2ª falha → 2 × BASE        3ª falha em diante → teto (2 × BASE)
      // Então as diferenças esperadas são BASE, BASE e ZERO — e é o zero que prova o teto.
      const second = await attempt(email, 'errada', from);
      expect(second.elapsed - first.elapsed).toBeGreaterThanOrEqual(THROTTLE_BASE_MS * 0.8);

      const third = await attempt(email, 'errada', from);
      expect(third.elapsed - second.elapsed).toBeGreaterThanOrEqual(THROTTLE_BASE_MS * 0.8);

      // Teto: a partir daqui NÃO cresce mais. Sem teto, o atraso viraria bloqueio de fato — e
      // bloqueio é o que este desenho recusa, por ser vetor de negação de serviço.
      const fourth = await attempt(email, 'errada', from);
      expect(fourth.elapsed - third.elapsed).toBeLessThan(THROTTLE_BASE_MS * 0.8);

      // E o teto é o valor CONFIGURADO, não um número qualquer: sem `Math.min`, a 4ª falha pediria
      // 8 × BASE. `first` é a medição sem atraso deste mesmo teste, então a conta isola o atraso.
      expect(fourth.elapsed - first.elapsed).toBeLessThan(THROTTLE_MAX_MS * 1.5);
    }, 60_000);

    it('é atraso e NÃO bloqueio: a senha certa continua entrando', async () => {
      // A garantia contra negação de serviço. Depois de três falhas, o dono da conta espera e entra —
      // um bloqueio duro o deixaria de fora, e quem soubesse o e-mail dele o trancaria de propósito.
      const from = ip(11);
      resetLadder(ACCOUNT.email);
      await attempt(ACCOUNT.email, 'errada', from);
      await attempt(ACCOUNT.email, 'errada', from);
      await attempt(ACCOUNT.email, 'errada', from);

      const success = await attempt(ACCOUNT.email, ACCOUNT.password, from);
      expect(success.error).toBeNull();
    }, 60_000);

    it('o acerto zera a escada da credencial', async () => {
      const from = ip(12);
      resetLadder(ACCOUNT.email);
      await attempt(ACCOUNT.email, 'errada', from);
      await attempt(ACCOUNT.email, 'errada', from);
      await attempt(ACCOUNT.email, ACCOUNT.password, from);

      // Zerada: a próxima falha é tratada como primeira. Comparada com um controle medido agora, a
      // diferença tem de ficar bem abaixo de um degrau.
      const reference = await control(ip(13), ip(14));
      const afterSuccess = await attempt(ACCOUNT.email, 'errada', from);
      expect(afterSuccess.elapsed - reference.elapsed).toBeLessThan(THROTTLE_BASE_MS * 0.8);
    }, 60_000);
  });

  describe('camada 1 — teto de falhas por IP', () => {
    it(`recusa com TooMany depois de ${THROTTLE_IP_LIMIT} falhas da mesma origem`, async () => {
      const from = ip(20);

      // Cada falha usa um e-mail DIFERENTE, que é como a varredura real se comporta — e prova que o
      // teto conta por origem, não por credencial.
      for (let i = 0; i < THROTTLE_IP_LIMIT; i += 1) {
        const result = await attempt(strangerEmail(), 'errada', from);
        expect(result.error?.constructor.name).toBe('InvalidCredentialsException');
      }

      const blocked = await attempt(strangerEmail(), 'errada', from);
      expect(blocked.error?.constructor.name).toBe('TooManyLoginAttemptsException');
      // Recusa barata: nem espera o atraso, nem toca o banco. Comparada com uma tentativa normal
      // medida em seguida, de outra origem, tem de ser drasticamente mais rápida.
      const normal = await control(ip(23), ip(24));
      expect(blocked.elapsed).toBeLessThan(normal.elapsed);
    }, 90_000);

    it('não afeta outra origem', async () => {
      // Se o teto vazasse entre IPs, uma varredura contra a plataforma tiraria do ar todos os
      // clientes de uma vez.
      const result = await attempt(strangerEmail(), 'errada', ip(21));
      expect(result.error?.constructor.name).toBe('InvalidCredentialsException');
    }, 60_000);

    it('o teto por IP não é perdoado por um acerto', async () => {
      const from = ip(22);
      for (let i = 0; i < THROTTLE_IP_LIMIT; i += 1) {
        await attempt(strangerEmail(), 'errada', from);
      }
      // Um acerto no meio da varredura não devolve crédito ao atacante.
      await attempt(ACCOUNT.email, ACCOUNT.password, from).catch(() => undefined);

      const stillBlocked = await attempt(strangerEmail(), 'errada', from);
      expect(stillBlocked.error?.constructor.name).toBe('TooManyLoginAttemptsException');
    }, 90_000);
  });

  describe('a resposta não denuncia o estado do atraso', () => {
    it('conta inexistente e conta atrasada respondem a MESMA exceção e mensagem', async () => {
      const from = ip(30);
      resetLadder(ACCOUNT.email);

      // Conta real, já com falhas acumuladas — portanto "atrasada".
      await attempt(ACCOUNT.email, 'errada', from);
      const delayed = await attempt(ACCOUNT.email, 'errada', from);

      // Conta que não existe, com o mesmo histórico de falhas.
      const stranger = strangerEmail();
      await attempt(stranger, 'errada', from);
      const unknown = await attempt(stranger, 'errada', from);

      expect(delayed.error).toBeInstanceOf(Error);
      expect(unknown.error).toBeInstanceOf(Error);
      expect(unknown.error?.constructor).toBe(delayed.error?.constructor);
      expect(unknown.error?.message).toBe(delayed.error?.message);
    }, 90_000);

    it('e levam o MESMO tempo aparente', async () => {
      // O teste que justifica a chave da escada ser o e-mail submetido, e não o id do usuário.
      // Se só contas reais acumulassem atraso, o cronômetro diria quais e-mails existem — oráculo de
      // enumeração pela porta dos fundos, num fluxo desenhado inteiro para não ter um.
      const from = ip(31);
      const stranger = strangerEmail();
      // As duas escadas no MESMO ponto de partida. Sem isto, a conta real chega com as falhas que os
      // testes anteriores deixaram e a comparação mediria históricos diferentes, não o desenho.
      resetLadder(ACCOUNT.email);

      // Mesmo número de falhas anteriores para as duas credenciais.
      await attempt(ACCOUNT.email, 'errada', from);
      await attempt(stranger, 'errada', from);

      const real = await attempt(ACCOUNT.email, 'errada', from);
      const fake = await attempt(stranger, 'errada', from);

      // As duas pagam o atraso da 1ª falha. Provado contra um controle medido no mesmo instante,
      // numa origem própria para não interferir no teto.
      const reference = await control(ip(32), ip(33));
      expect(real.elapsed - reference.elapsed).toBeGreaterThanOrEqual(THROTTLE_BASE_MS * 0.8);
      expect(fake.elapsed - reference.elapsed).toBeGreaterThanOrEqual(THROTTLE_BASE_MS * 0.8);

      // E a diferença entre elas fica dentro do ruído — não há sinal a explorar. A tolerância é
      // metade do atraso base: uma diferença sistemática de meio degrau já seria mensurável por quem
      // repetisse a medição, e é isso que não pode existir.
      const difference = Math.abs(real.elapsed - fake.elapsed);
      expect(difference).toBeLessThan(THROTTLE_BASE_MS / 2);
    }, 90_000);
  });
  describe('na camada HTTP', () => {
    let app: NestFastifyApplication;
    let baseUrl: string;

    /**
     * Sobe o servidor de verdade por `createApp()` — mesma wiring do `main.ts`, com o
     * `GlobalExceptionFilter` que traduz a exceção em status. Sem ele, a exceção viraria 500 e
     * ninguém notaria: o teste de use case acima passa exatamente do mesmo jeito.
     */
    beforeAll(async () => {
      // Devolvida só para este segundo boot — ver o comentário de OWNER_URL_AT_LOAD.
      process.env.DATABASE_URL_MIGRATIONS = OWNER_URL_AT_LOAD;
      app = await createApp();
      await app.listen(0, '127.0.0.1');
      baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api`;
    }, 60_000);

    afterAll(async () => {
      if (app) {
        await app.close();
      }
    });

    /**
     * `X-Forwarded-For` controla o IP visto pela aplicação porque o Fastify sobe com
     * `trustProxy: true` — necessário atrás do Traefik, onde o IP do socket é o do proxy. Este teste
     * verifica as duas coisas de uma vez: o teto por IP na borda e o fato de o IP real ser lido do
     * cabeçalho, sem o qual TODA requisição de produção contaria para o mesmo "IP" (o do proxy) e o
     * teto derrubaria a plataforma inteira depois de algumas falhas.
     */
    const login = (email: string, password: string, forwardedFor: string) =>
      fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': forwardedFor },
        body: JSON.stringify({ email, password }),
      });

    it('responde 401 nas falhas e 429 quando o teto do IP estoura', async () => {
      const from = '198.51.100.7';

      for (let i = 0; i < THROTTLE_IP_LIMIT; i += 1) {
        const response = await login(strangerEmail(), 'errada', from);
        expect(response.status).toBe(401);
      }

      const blocked = await login(strangerEmail(), 'errada', from);
      expect(blocked.status).toBe(429);

      const body = (await blocked.json()) as { message?: string };
      // A mensagem fala da ORIGEM, nunca da conta: dizer "esta conta está bloqueada" seria confirmar
      // que ela existe.
      expect(body.message).toMatch(/origem/i);
      expect(JSON.stringify(body)).not.toContain('@');
    }, 120_000);

    it('outra origem continua recebendo 401, não 429', async () => {
      const response = await login(strangerEmail(), 'errada', '198.51.100.8');
      expect(response.status).toBe(401);
    }, 60_000);
  });
});
