/**
 * Cria (ou promove) um usuário administrador.
 *
 * Necessário porque o cadastro público cria todo mundo como `user`, e a primeira sincronização
 * do catálogo (`POST /api/admin/catalog/sync`) exige o AdminGuard. Sem isso, um ambiente novo
 * fica sem forma de popular o catálogo.
 *
 * Uso (dentro de apps/plano-diario/backend):
 *   npm run create:admin -- --email=eliab@exemplo.com --name="Eliab Caetano" --password=SenhaForte123 --phone="(11) 91234-5678"
 *
 * `--phone` é o WhatsApp de contato, por onde a recuperação de senha fala com o dono. Opcional
 * aqui (dá para preencher depois na tela), mas sem ele a conta não consegue recuperar senha.
 *
 * Se o e-mail já existir, o script apenas promove a conta a admin (e troca a senha se `--password`
 * for informado) — nunca cria duplicado.
 *
 * A senha é lida do argumento e some com o processo: nada é logado, nem em caso de erro.
 */
import { MikroORM } from '@mikro-orm/postgresql';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createMikroOrmConfig } from '../infrastructure/persistence/mikro-orm/config/mikro-orm.config';
import { UserOrmEntity } from '../infrastructure/persistence/mikro-orm/entities/user-orm.entity';
// Mesmo escrevendo direto na entidade ORM, a validação do número vem do domínio: um script não
// tem licença para gravar um telefone que a aplicação recusaria.
import { PhoneNumber } from '../contexts/user/domain/value-objects/phone-number.vo';

// Em dev as variáveis vêm do .env; no container de produção elas já estão no ambiente
// (e o `dotenv` não é instalado lá), então o carregamento é opcional.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv/config');
} catch {
  // sem .env — segue com o que estiver em process.env
}

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

function parseArgs(): { email: string; name?: string; password?: string; phone?: string } {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) {
      args.set(match[1], match[2]);
    }
  }
  const email = args.get('email');
  if (!email) {
    throw new Error(
      'Uso: npm run create:admin -- --email=<email> [--name="Nome"] [--password=<senha>] [--phone="(11) 91234-5678"]',
    );
  }
  return {
    email: email.toLowerCase().trim(),
    name: args.get('name'),
    password: args.get('password'),
    phone: args.get('phone'),
  };
}

async function main(): Promise<void> {
  const { email, name, password, phone } = parseArgs();

  if (password && password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  // Valida antes de abrir conexão: erro de digitação no número não deve criar nada pela metade.
  const normalizedPhone = phone ? PhoneNumber.create(phone).value : null;

  const orm = await MikroORM.init(createMikroOrmConfig((key) => process.env[key]));
  try {
    const em = orm.em.fork();
    const existing = await em.findOne(UserOrmEntity, { email });

    if (existing) {
      existing.role = 'admin';
      existing.isActive = true;
      if (password) {
        existing.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      }
      if (normalizedPhone) {
        existing.phone = normalizedPhone;
      }
      existing.updatedAt = new Date();
      await em.flush();
      // eslint-disable-next-line no-console
      console.log(
        `Conta existente promovida a admin: ${email}${password ? ' (senha atualizada)' : ''}` +
          // Confirma que gravou, sem ecoar o número inteiro no terminal.
          `${normalizedPhone ? ' (WhatsApp atualizado)' : ''}`,
      );
      return;
    }

    if (!password) {
      throw new Error('Conta nova exige --password');
    }

    const user = new UserOrmEntity();
    user.id = randomUUID();
    user.email = email;
    user.name = (name ?? email.split('@')[0]).trim().slice(0, 120);
    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    user.phone = normalizedPhone;
    user.role = 'admin';
    user.isActive = true;
    user.createdAt = new Date();
    user.updatedAt = new Date();

    await em.persistAndFlush(user);
    // eslint-disable-next-line no-console
    console.log(`Admin criado: ${email} (id ${user.id})`);
  } finally {
    await orm.close(true);
  }
}

main().catch((error) => {
  // Mensagem apenas — sem stack e sem ecoar os argumentos (a senha vem por argumento).
  // eslint-disable-next-line no-console
  console.error(`Falha: ${(error as Error).message}`);
  process.exit(1);
});
