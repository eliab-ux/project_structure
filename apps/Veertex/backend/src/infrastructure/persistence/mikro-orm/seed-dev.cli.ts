// ⚠️ PRIMEIRO import, obrigatoriamente — troca a conexão para o papel OWNER antes que o AppModule
// carregue o .env. Mesmo motivo do create-account.cli.ts.
import './cli-owner-connection';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { CreateAccountUseCase } from '../../../contexts/account/application/use-cases/create-account/create-account.use-case';
import { CreateAccountCommand } from '../../../contexts/account/application/use-cases/create-account/create-account.command';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../contexts/account/application/ports/output/account-repository.port';

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
    '44555666000172',
    'ESSENCIAL',
    'Kaza Tem Comércio Ltda',
    '44555666000172',
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

async function run(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed:dev não roda com NODE_ENV=production.');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const logger = new Logger('seed:dev');

  try {
    const createAccount = app.get(CreateAccountUseCase);
    const accounts = app.get<AccountRepositoryPort>(ACCOUNT_REPOSITORY);

    for (const command of DEV_ACCOUNTS) {
      // Idempotência por documento, não por try/catch no erro de unicidade: rodar o seed duas vezes
      // é o caso NORMAL (toda vez que alguém recria o banco local), não uma exceção a tratar.
      const existing = await accounts.findByDocument(command.accountDocument);
      if (existing) {
        logger.log(`Conta "${command.accountName}" já existe — nada a fazer.`);
        continue;
      }

      const result = await createAccount.execute(command);
      logger.log(`Conta "${command.accountName}" criada (${result.account.id}).`);
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
