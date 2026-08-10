// ⚠️ PRIMEIRO import, obrigatoriamente: troca a conexão para o papel OWNER antes que o AppModule
// carregue o .env. Ver o docblock do módulo — a ordem aqui não é estilo, é o que faz o comando
// funcionar.
import './cli-owner-connection';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { CreateAccountUseCase } from '../../../contexts/account/application/use-cases/create-account/create-account.use-case';
import { CreateAccountCommand } from '../../../contexts/account/application/use-cases/create-account/create-account.command';

interface CliArgs {
  [key: string]: string | boolean;
}

/** Minimal `--flag value` / `--flag` parser. No dependency for a script with a dozen options. */
function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function required(args: CliArgs, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Argumento obrigatório ausente: --${key}`);
  }
  return value;
}

function optional(args: CliArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

const USAGE = `
Cria a primeira conta do Veertex (conta + empresa + papéis padrão + admin), tudo numa transação.

  npm run create:account -- \\
    --account-name "Tudodicasa" \\
    --account-document "12345678000195" \\
    --plan COMPLETO \\
    --company-legal-name "Tudodicasa Comércio Ltda" \\
    --company-document "12345678000195" \\
    --tax-regime SIMPLES \\
    --state-registration-exempt \\
    --street "Av. Central" --number "1000" --district "Centro" \\
    --city "Goiânia" --state GO --zip "74000000" --ibge "5208707" \\
    --admin-name "Eliab" --admin-email "eliab@exemplo.com.br" \\
    --admin-phone "62999999999" --admin-password "<senha-forte>"

Opcionais: --company-trade-name, --state-registration, --complement, --timezone
Regimes: SIMPLES | NORMAL | MEI
`;

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || Object.keys(args).length === 0) {
    // eslint-disable-next-line no-console
    console.log(USAGE);
    return;
  }

  const command = new CreateAccountCommand(
    required(args, 'account-name'),
    required(args, 'account-document'),
    required(args, 'plan'),
    required(args, 'company-legal-name'),
    required(args, 'company-document'),
    required(args, 'tax-regime'),
    {
      street: required(args, 'street'),
      number: required(args, 'number'),
      complement: optional(args, 'complement') ?? null,
      district: required(args, 'district'),
      city: required(args, 'city'),
      state: required(args, 'state'),
      zipCode: required(args, 'zip'),
      ibgeCityCode: optional(args, 'ibge') ?? null,
    },
    args['state-registration-exempt'] === true || args['state-registration-exempt'] === 'true',
    required(args, 'admin-name'),
    required(args, 'admin-email'),
    required(args, 'admin-phone'),
    required(args, 'admin-password'),
    optional(args, 'company-trade-name') ?? null,
    optional(args, 'state-registration') ?? null,
    optional(args, 'timezone'),
  );

  // `logger: false` on the context, then an explicit logger: Nest's boot banner would otherwise
  // bury the one line the operator is here to read.
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const logger = new Logger('create:account');

  try {
    const result = await app.get(CreateAccountUseCase).execute(command);

    // The password is NEVER echoed back, not even here — whoever ran the command typed it, and a
    // terminal scrollback is a log like any other (CLAUDE.md).
    logger.log('✅ Conta criada com sucesso');
    // eslint-disable-next-line no-console
    console.log(`
  Conta ......... ${result.account.name} (${result.account.id})
  Documento ..... ${result.account.documentFormatted}
  Empresa ....... ${result.companyId}
  Admin ......... ${command.adminEmail} (${result.adminUserId})
  Papéis ........ 7 papéis padrão criados (ADMIN, MANAGER, SUPERVISOR, CASHIER,
                  SALES_REP, DELIVERY, ACCOUNTANT)

  Entre em ${process.env.FRONTEND_URL ?? 'http://localhost:3021'} com o e-mail e a senha informados.
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
