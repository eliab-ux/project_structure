// ⚠️ PRIMEIRO import, obrigatoriamente — troca a conexão para o papel OWNER antes que o AppModule
// carregue o .env. Mesmo motivo do create-account.cli.ts.
import './cli-owner-connection';

import { NestFactory } from '@nestjs/core';
import { Client } from 'pg';
import { AppModule } from '../../../app.module';
import { CreateAccountUseCase } from '../../../contexts/account/application/use-cases/create-account/create-account.use-case';
import { CreateAccountCommand } from '../../../contexts/account/application/use-cases/create-account/create-account.command';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../contexts/account/application/ports/output/account-repository.port';
import { runInRequestContext } from './cli-request-context';

/**
 * `npm run seed:dev` — duas contas de desenvolvimento com dados plausíveis.
 *
 * DUAS, e não uma, de propósito: a maior parte dos bugs de multi-tenancy só é visível quando existe
 * um segundo tenant para vazar. Com uma única conta, uma query sem escopo devolve exatamente o mesmo
 * resultado de uma query escopada, e o erro passa despercebido até produção.
 *
 * Vive fora do bootstrap do boot deliberadamente. O bootstrap semeia o catálogo de PLANOS, que é
 * infraestrutura do produto; contas de demonstração não são — e um boot capaz de criar contas é
 * exatamente o tipo de coisa que um dia roda em produção por engano.
 *
 * Reusa `CreateAccountUseCase` em vez de INSERTs diretos: hash de senha, papéis padrão e as
 * invariantes de domínio ficam com uma implementação só. Um seed que montasse as linhas na mão
 * envelheceria em silêncio na primeira regra nova.
 *
 * ⚠️ Os CNPJs abaixo são fictícios mas têm DÍGITO VERIFICADOR VÁLIDO, e precisam ter. O VO
 * `Document` valida os dois dígitos no construtor, então um CNPJ inventado à mão (`4455566600017`
 * com um dígito qualquer no fim) derruba o seed inteiro com "CNPJ inválido" — foi o que aconteceu
 * na primeira execução real deste comando. Ao acrescentar uma conta aqui, gere o número com o
 * cálculo dos dígitos; não o digite.
 */
const DEV_ACCOUNTS: CreateAccountCommand[] = [
  new CreateAccountCommand(
    'Tudodicasa (dev)',
    '11222333000181',
    'COMPLETO',
    'Tudodicasa Comércio de Utilidades Ltda',
    '11222333000181',
    'SIMPLES',
    {
      street: 'Avenida Anhanguera',
      number: '1500',
      complement: null,
      district: 'Setor Central',
      city: 'Goiânia',
      state: 'GO',
      zipCode: '74035010',
      ibgeCityCode: '5208707',
    },
    true,
    'Eliab Dev',
    'eliab@dev.veertex.local',
    '62999990001',
    'veertex-dev-2026',
    'Tudodicasa',
    null,
    'America/Sao_Paulo',
  ),
  new CreateAccountCommand(
    'Kaza Tem (dev)',
    '44555666000181',
    'ESSENCIAL',
    'Kaza Tem Comércio Ltda',
    '44555666000181',
    'SIMPLES',
    {
      street: 'Rua das Palmeiras',
      number: '220',
      complement: 'Sala 3',
      district: 'Jardim América',
      city: 'Goiânia',
      state: 'GO',
      zipCode: '74265010',
      ibgeCityCode: '5208707',
    },
    true,
    'Maria Dev',
    'maria@dev.veertex.local',
    '62999990002',
    'veertex-dev-2026',
    'Kaza Tem',
    null,
    'America/Sao_Paulo',
  ),
];

/**
 * Barreira de DADO: recusa se existir qualquer conta que não seja uma das demo.
 *
 * Substitui a checagem anterior de `NODE_ENV=production`, e a troca é a diferença entre uma barreira
 * e um aviso. `NODE_ENV` é controlado por quem invoca o comando — um `-e NODE_ENV=development` no
 * `docker exec` a derrubava, e é justamente quem tem acesso ao container que teria como fazê-lo. Já
 * "este banco tem conta de cliente" não é negociável por variável de ambiente: ou tem, ou não tem.
 *
 * Roda como OWNER (o `cli-owner-connection` já trocou a conexão), então enxerga todas as contas
 * independentemente de RLS — que é exatamente o necessário aqui: a pergunta é sobre o banco inteiro,
 * não sobre um tenant.
 *
 * ⚠️ Resta um caso: um banco de produção AINDA VAZIO aceitaria o seed, porque não há conta não-demo.
 * É a razão de a checagem de `NODE_ENV` continuar abaixo como segunda camada — env ser derrubável a
 * torna insuficiente como única barreira, não inútil como segunda.
 */
async function assertDatabaseIsSafeToSeed(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL ausente.');
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const demoDocuments = DEV_ACCOUNTS.map((command) => command.accountDocument);
    const { rows } = await client.query<{ name: string; document: string }>(
      'select name, document from accounts where document <> all($1::text[]) limit 5',
      [demoDocuments],
    );

    if (rows.length > 0) {
      // Nomeia as contas encontradas: "há contas reais" sozinho deixa o operador sem saber se
      // esbarrou num resto de teste ou num cliente de verdade.
      const found = rows.map((row) => `"${row.name}"`).join(', ');
      throw new Error(
        `Este banco tem conta(s) que não são de demonstração: ${found}. O seed de desenvolvimento ` +
          'não roda aqui — ele existe para popular um banco descartável, e num banco com dado real ' +
          'criaria contas de mentira ao lado de contas de cliente.',
      );
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function run(): Promise<void> {
  // Barreira primária: o estado do BANCO.
  await assertDatabaseIsSafeToSeed();

  // Segunda camada. Mantida de propósito: cobre o caso que a barreira de dado não cobre — um banco
  // de produção ainda vazio. Duas camadas independentes custam uma linha.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'seed:dev não roda com NODE_ENV=production, mesmo num banco sem contas reais. ' +
        'Se a intenção é popular um banco descartável, rode sem NODE_ENV=production.',
    );
  }

  // `logger: ['error','warn']` cala o banner de boot do Nest, que enterraria o resultado sob
  // dezenas de linhas de rotas mapeadas. O preço é que `Logger.log()` também some — o nível `log`
  // está fora da lista —, e por isso o retorno ao operador sai por `console.log` daqui para baixo.
  // A versão anterior usava `logger.log()` e o comando rodava sem imprimir NADA sobre as contas:
  // o seed parecia não ter feito nada, e só o banco dizia o contrário.
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const createAccount = app.get(CreateAccountUseCase);
    const accounts = app.get<AccountRepositoryPort>(ACCOUNT_REPOSITORY);

    // Um contexto POR CONTA, não um só para o laço inteiro: cada conta é uma unidade de trabalho
    // independente, e compartilhar identity map entre elas faria a segunda enxergar as entidades
    // pendentes da primeira — justamente o vazamento entre tenants que este seed existe para expor.
    for (const command of DEV_ACCOUNTS) {
      await runInRequestContext(app, async () => {
        // Idempotência por documento, não por try/catch no erro de unicidade: rodar o seed duas
        // vezes é o caso NORMAL (toda vez que alguém recria o banco local), não uma exceção.
        const existing = await accounts.findByDocument(command.accountDocument);
        if (existing) {
          // eslint-disable-next-line no-console
          console.log(`  • "${command.accountName}" já existe — nada a fazer.`);
          return;
        }

        const result = await createAccount.execute(command);
        // eslint-disable-next-line no-console
        console.log(`  • "${command.accountName}" criada (${result.account.id}).`);
      });
    }

    // eslint-disable-next-line no-console
    console.log(`
  Contas de desenvolvimento prontas. Entre com qualquer uma:

    eliab@dev.veertex.local  /  veertex-dev-2026   (Tudodicasa, plano COMPLETO)
    maria@dev.veertex.local  /  veertex-dev-2026   (Kaza Tem,   plano ESSENCIAL)

  Senha em texto claro aqui porque é ambiente de desenvolvimento e o valor é fixo e público neste
  arquivo — nunca use este comando com um banco que contenha dado real.
`);
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`❌ ${(error as Error)?.message ?? error}`);
  process.exit(1);
});
