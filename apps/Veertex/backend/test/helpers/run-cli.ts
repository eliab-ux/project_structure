import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** stdout + stderr, para asserções do tipo "a saída em algum lugar diz X". */
  output: string;
}

/**
 * Afirma que a CLI saiu com sucesso, e falha com a SAÍDA INTEIRA na mensagem.
 *
 * `expect(result.exitCode).toBe(0)` diz "esperado 0, recebido 1" e obriga a rodar o comando à mão
 * para descobrir o que houve — e, quando a causa é interferência entre specs, rodar à mão passa e o
 * diagnóstico não avança. Custou uma investigação inteira; a saída no assert resolve na primeira
 * leitura do log.
 */
export function expectCliSuccess(result: CliResult, context = 'CLI'): void {
  if (result.exitCode !== 0) {
    throw new Error(
      `${context} saiu com código ${result.exitCode}. Saída completa:\n${result.output}`,
    );
  }
}

const BACKEND_ROOT = resolve(__dirname, '..', '..');
const CLI_DIR = join(BACKEND_ROOT, 'src', 'infrastructure', 'persistence', 'mikro-orm');

/**
 * Executa uma CLI como PROCESSO DE VERDADE e devolve saída e código de saída.
 *
 * **Por que processo, e não `import { run } from '../cli'; await run()`.** Importar e chamar a
 * função é mais rápido e mais fácil de depurar — e não teria pego nenhum dos quatro defeitos que a
 * primeira execução real revelou:
 *
 *   - o `RequestContext` ausente depende de o `AppModule` subir num processo sem requisição HTTP;
 *   - o `cli-owner-connection` só funciona por ser o PRIMEIRO import, e a ordem de hoisting some
 *     quando outro arquivo de teste já importou o `AppModule` antes;
 *   - o `logger: ['error','warn']` engolindo o `Logger.log()` só aparece olhando o stdout real;
 *   - o código de saída (`process.exit(1)`) não existe para quem chamou a função.
 *
 * O que se quer verificar aqui é o PONTO DE ENTRADA — parsing de argumento, ordem de import,
 * configuração de log, código de saída —, e isso só existe quando há um processo.
 *
 * `transpile-only` de propósito: a checagem de tipos é responsabilidade do `npm run typecheck`, que
 * roda sobre o projeto inteiro. Repeti-la a cada spawn acrescentaria segundos por teste para
 * verificar de novo o que já foi verificado.
 */
export function runCli(
  scriptName: string,
  args: string[] = [],
  extraEnv: Record<string, string | undefined> = {},
): Promise<CliResult> {
  const scriptPath = join(CLI_DIR, scriptName);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TS_NODE_PROJECT: join(BACKEND_ROOT, 'tsconfig.json'),
  };
  // `undefined` REMOVE a variável, em vez de definir a string "undefined". É o que permite testar
  // o caminho "senha ausente" mesmo quando quem roda a suíte tem a variável exportada no shell.
  for (const [key, value] of Object.entries(extraEnv)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      ['-r', 'ts-node/register/transpile-only', scriptPath, ...args],
      { cwd: BACKEND_ROOT, env, windowsHide: true },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', rejectPromise);
    child.on('close', (code) => {
      resolvePromise({
        exitCode: code ?? -1,
        stdout,
        stderr,
        output: `${stdout}\n${stderr}`,
      });
    });
  });
}
