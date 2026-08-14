import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { loadEnvFiles } from '../src/config/load-env';
import { applyTestDatabaseEnv } from './test-database';

/**
 * Cria o schema do BANCO DE TESTE antes da suíte — uma vez, e **em processo separado**.
 *
 * **Por que existe** (achado ao separar os bancos, 13/08/2026): num banco de teste recém-provisionado
 * existem os papéis e os privilégios, mas nenhuma tabela. O primeiro spec a rodar quebrava no próprio
 * `beforeAll` de limpeza, com `relation "accounts" does not exist` — e qual spec é o primeiro depende
 * da ordem por duração estimada do Jest, então a falha era diferente a cada execução.
 *
 * Antes isso não aparecia porque a suíte usava o banco de desenvolvimento, cujo schema alguém havia
 * criado à mão. A separação tornou a dependência visível: um banco de teste que só funciona depois de
 * um comando manual é um banco que quebra no CI e na máquina de quem clona o repositório.
 *
 * **Por que `execFileSync` e não `MikroORM.init()` aqui dentro** — e isto custou uma execução inteira
 * para descobrir: o `globalSetup` roda no processo principal do Jest, mas os specs rodam em contextos
 * `vm` separados. Inicializar o ORM aqui popula a metadata global do MikroORM no realm do processo
 * principal, e o primeiro spec que sobe o Nest morre com
 * `TypeError: Method Map.prototype.set called on incompatible receiver #<Map>` — um `Map` de um realm
 * usado por código de outro. O erro aparece longe da causa (dentro do `MetadataDiscovery`, num spec
 * qualquer), e o `process.exit(1)` do Nest derruba a execução sem resumo nenhum.
 *
 * Processo separado elimina o problema por construção, e de graça: o custo é um spawn de poucos
 * segundos, uma vez por suíte.
 *
 * **Usa o `migrate.ts` de produção**, não `schema:create`. Gerar o schema a partir das entidades
 * produz um banco parecido, não igual: o que está nas migrations — policies de RLS, `enable row level
 * security`, grants — é justamente o que os testes de isolamento existem para verificar. Testar
 * contra um schema gerado por outro caminho anularia o propósito.
 */
export default function globalSetup(): void {
  loadEnvFiles();
  applyTestDatabaseEnv();

  const script = join(
    __dirname,
    '..',
    'src',
    'infrastructure',
    'persistence',
    'mikro-orm',
    'migrate.ts',
  );

  execFileSync(process.execPath, ['-r', 'ts-node/register/transpile-only', script], {
    // `process.env` já trocado por `applyTestDatabaseEnv()` — o filho herda o banco de TESTE.
    env: process.env,
    // `pipe` e não `inherit`: em execução limpa o migrator não tem nada a dizer, e o ruído dele antes
    // do primeiro teste faria parecer que a suíte está fazendo algo estranho. Em falha, a saída
    // capturada vai para a exceção abaixo, que é onde se olha.
    stdio: 'pipe',
    cwd: join(__dirname, '..'),
  });
}
