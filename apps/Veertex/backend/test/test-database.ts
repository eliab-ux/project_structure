/**
 * A troca para o BANCO DE TESTE e a guarda que a torna confiável — num lugar só.
 *
 * **Por que existe** (Eliab, 13/08/2026): dev e teste compartilhavam o banco `veertex`. A suíte apaga
 * contas por desenho — é o que dá sentido aos testes de isolamento entre tenants —, então rodá-la
 * apagava os dados de quem estivesse com a aplicação aberta. Aconteceu: o login passou a responder
 * `unknown_email` no meio de uma sessão porque a conta do `seed:dev` havia sido removida.
 *
 * **Por que num módulo compartilhado e não em cada ponto:** isto é chamado de DOIS lugares — o
 * `globalSetup` (que migra o banco antes da suíte) e o `setupFiles` (que roda por arquivo de spec).
 * Duas cópias da guarda divergiriam na primeira alteração, e a que divergisse seria justamente a que
 * ninguém exercita.
 */

const DEV_TEST_PAIRS = [
  ['DATABASE_URL', 'DATABASE_URL_TEST'],
  ['DATABASE_URL_MIGRATIONS', 'DATABASE_URL_MIGRATIONS_TEST'],
] as const;

function abort(message: string): never {
  // `console.error` e não um logger: isto roda antes de qualquer coisa do Nest existir.
  console.error(
    [
      '',
      '  A SUÍTE NÃO VAI RODAR — o banco de teste não está configurado.',
      `  ${message}`,
      '',
      '  Configure no .env.local (ver .env.example):',
      '    DATABASE_URL_TEST=postgresql://veertex_app:<senha>@127.0.0.1:5433/veertex_test',
      '    DATABASE_URL_MIGRATIONS_TEST=postgresql://veertex_owner:<senha>@127.0.0.1:5433/veertex_test',
      '',
      '  E provisione o banco com o MESMO script de produção (ver backend/README.md §6):',
      '    docker exec -i veertex-pg-dev psql -U postgres -d postgres -v ON_ERROR_STOP=1 \\',
      '      -v db_name=veertex_test -v owner_password=<senha> -v app_password=<senha> \\',
      '      -f - < deploy/sql/001_create_roles.sql',
      '',
      '  Isto existe porque a suíte APAGA CONTAS: sem banco separado, rodar os testes destrói os',
      '  dados de desenvolvimento de quem estiver com a aplicação aberta.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

/**
 * Aponta `DATABASE_URL` e `DATABASE_URL_MIGRATIONS` para o banco de teste, abortando o processo se
 * a configuração não for segura.
 *
 * **A guarda é a parte que importa, não a troca.** Trocar a URL é trivial; o risco real é a troca
 * NÃO acontecer e ninguém perceber — a suíte roda verde e limpa o banco de desenvolvimento
 * exatamente como antes. Duas verificações:
 *
 *  1. as duas variáveis de teste precisam existir;
 *  2. o nome do banco tem de conter `test` — um `DATABASE_URL_TEST` apontando para `veertex` por
 *     descuido de digitação é exatamente o acidente que se quer impedir, e esta é a verificação que
 *     o impede.
 *
 * **Havia uma terceira, e ela foi removida por ter disparado contra a própria troca** (medido em
 * 13/08/2026): "a URL de teste não pode ser igual à de desenvolvimento". O `globalSetup` roda no
 * processo principal do Jest e faz a troca ali; o Jest então copia esse `process.env` já trocado para
 * o ambiente de cada spec, onde o `setupFiles` chama esta função de novo — e aí `DATABASE_URL` JÁ era
 * a de teste, o que fazia a verificação abortar a suíte inteira antes do primeiro teste. A função
 * precisa ser **idempotente**, e a verificação de igualdade não sobrevive a isso. Ela também era
 * redundante: se o banco de teste tem `test` no nome e o de desenvolvimento não, as duas não podem
 * ser iguais — a verificação 2 já cobre o acidente.
 *
 * `process.exit(1)` e não `throw`: um `throw` no `setupFiles` é reportado como falha de UM arquivo de
 * spec, e os outros seguiriam rodando contra o banco errado. Abortar o processo para tudo.
 */
export function applyTestDatabaseEnv(): void {
  for (const [devKey, testKey] of DEV_TEST_PAIRS) {
    const testUrl = process.env[testKey];
    if (!testUrl) {
      abort(`${testKey} não está definida.`);
    }

    let database: string;
    try {
      database = new URL(testUrl).pathname.replace(/^\//, '');
    } catch {
      abort(`${testKey} não é uma URL de conexão válida.`);
    }
    if (!database.toLowerCase().includes('test')) {
      abort(`${testKey} aponta para o banco "${database}", cujo nome não contém "test".`);
    }

    // A troca em si. Daqui para frente, todo código sob teste — app, CLIs spawnados e helpers —
    // enxerga o banco de teste, porque os CLIs herdam este `process.env`.
    process.env[devKey] = testUrl;
  }
}
