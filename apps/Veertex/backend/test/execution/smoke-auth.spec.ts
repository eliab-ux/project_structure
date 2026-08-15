import { randomBytes } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { Client } from 'pg';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/create-app';
import { runCli } from '../helpers/run-cli';
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
 * `smoke:auth` — o fluxo de autenticação ponta a ponta, contra um servidor de verdade.
 *
 * O servidor sobe por `createApp()`, a MESMA função que o `main.ts` usa. Isso não é detalhe: um app
 * montado à parte no teste não teria prefixo `/api`, `ValidationPipe` nem `GlobalExceptionFilter`, e
 * as asserções passariam a descrever uma configuração que ninguém opera. Ver o docblock de
 * `create-app.ts`.
 *
 * A conta é criada pela CLI real, e não por INSERT: o hash da senha precisa ser o que o
 * `create:account` produz, porque é justamente a compatibilidade entre quem grava e quem confere
 * que o login exercita.
 *
 * Porta efêmera (`listen(0)`) porque a 3020 costuma estar ocupada pelo backend de desenvolvimento
 * de quem está rodando a suíte — e um teste que exige a porta livre falha por motivo que não é dele.
 */

const DOCUMENT = cnpjWithCheckDigits('900000040001');
const EMAIL = 'exec-smoke@teste.veertex.local';

describe('smoke:auth — execução real contra servidor de verdade', () => {
  let owner: Client;
  let app: NestFastifyApplication;
  let baseUrl: string;
  const password = randomBytes(15).toString('base64url');

  beforeAll(async () => {
    owner = await connectAsOwner();
    await deleteAccountsByDocument(owner, [DOCUMENT]);

    const created = await runCli(
      'create-account.cli.ts',
      [
        '--account-name',
        'Conta do Smoke',
        '--account-document',
        DOCUMENT,
        '--plan',
        'COMPLETO',
        '--company-legal-name',
        'Conta do Smoke Ltda',
        '--company-document',
        DOCUMENT,
        '--tax-regime',
        'SIMPLES',
        '--state-registration-exempt',
        '--street',
        'Rua do Smoke',
        '--number',
        '10',
        '--district',
        'Centro',
        '--city',
        'Goiania',
        '--state',
        'GO',
        '--zip',
        '74000000',
        '--admin-name',
        'Admin do Smoke',
        '--admin-email',
        EMAIL,
        '--admin-phone',
        '62999990010',
      ],
      { VEERTEX_ADMIN_PASSWORD: password },
    );
    if (created.exitCode !== 0) {
      throw new Error(
        `Pré-condição falhou — create:account saiu ${created.exitCode}:\n${created.output}`,
      );
    }

    app = await createApp();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api`;
  }, 120_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await deleteAccountsByDocument(owner, [DOCUMENT]);
    await owner.end();
  });

  it('passa em todas as verificações de autenticação', async () => {
    const result = await runCli('smoke-auth.ts', [], {
      SMOKE_BASE_URL: baseUrl,
      SMOKE_EMAIL: EMAIL,
      SMOKE_PASSWORD: password,
    });

    // A saída inteira entra na mensagem de falha: sem isso, um `expect(exitCode).toBe(0)` que
    // quebra diz "esperado 0, recebido 1" e obriga a rodar o comando à mão para descobrir qual das
    // dez verificações caiu.
    expect(result.output).toContain('todas passando');
    expect(result.exitCode).toBe(0);
  });

  it('reprova quando as credenciais estão erradas', async () => {
    // O contrapeso: prova que o smoke reprova de verdade, e não sai 0 por não ter verificado nada.
    const result = await runCli('smoke-auth.ts', [], {
      SMOKE_BASE_URL: baseUrl,
      SMOKE_EMAIL: EMAIL,
      SMOKE_PASSWORD: 'senha-que-nao-e-a-da-conta',
    });

    expect(result.exitCode).not.toBe(0);
  });

  it('exige SMOKE_EMAIL e SMOKE_PASSWORD, em vez de tentar login vazio', async () => {
    // Variáveis VAZIAS, não removidas. Removê-las não produz o cenário: `loadEnvFiles` usa
    // `override: false`, então o que falta no ambiente vem do `.env.local` — e o filho receberia as
    // credenciais do arquivo. Comportamento correto (shell ganha do arquivo, arquivo preenche a
    // lacuna), só não é o que este teste quer exercitar. A string vazia sobrevive ao dotenv, porque
    // a chave existe, e é falsy para a checagem do script.
    const result = await runCli('smoke-auth.ts', [], {
      SMOKE_BASE_URL: baseUrl,
      SMOKE_EMAIL: '',
      SMOKE_PASSWORD: '',
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('SMOKE_EMAIL');
  });
});
