import { config as dotenvConfig } from 'dotenv';

/**
 * A ordem de precedência dos arquivos de ambiente, em UM lugar.
 *
 * `.env.local` primeiro, `.env` depois: o local ganha. É o arquivo de quem está desenvolvendo,
 * aponta para o Postgres em `127.0.0.1:5433` e é gitignored; o `.env` é o de referência que
 * eventualmente acompanha um deploy.
 *
 * Existe como módulo próprio porque a lista precisa ser idêntica em SEIS pontos de entrada — o
 * ConfigModule da aplicação, o config do CLI do MikroORM, e cada CLI compilado (migrate,
 * verify-isolation, verify-rls, smoke-auth, create-account, seed-dev) — além do setup do jest.
 * Divergir em um deles produz o pior sintoma possível: o comando conecta no banco ERRADO, e o
 * erro (ou pior, o sucesso) aparece longe da causa.
 *
 * `override: false` mantém uma variável já exportada no shell — ou injetada pelo Dokploy — ganhando
 * dos dois arquivos. Em produção não existe arquivo nenhum, e a chamada é inofensiva.
 */
export const ENV_FILES = ['.env.local', '.env'] as const;

/** Para os pontos de entrada que não passam pelo ConfigModule (CLIs, jest, config do MikroORM). */
export function loadEnvFiles(): void {
  dotenvConfig({ path: [...ENV_FILES], override: false });
}
