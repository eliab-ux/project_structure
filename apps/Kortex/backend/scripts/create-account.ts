/**
 * Bootstrap de uma conta e do seu primeiro usuário `owner`.
 *
 * Existe porque não há — e não deve haver — rota pública de cadastro de conta: o Kortex é
 * multiconta, mas cada conta é uma operação real, criada por quem administra o servidor. Sem este
 * script, um banco recém-migrado não teria ninguém para autenticar e nenhuma tela seria alcançável.
 *
 *   npm run account:create -w apps/Kortex/backend -- \
 *     --name "Corte Ceres · APL" --city "Ceres" \
 *     --owner-name "Gleidson Dantas" --owner-email "gleidson@corteceres.com.br" \
 *     --owner-phone "62996010090" --owner-password "uma-senha-forte"
 *
 * A senha vem por argumento e não por prompt porque o script também roda em deploy, sem TTY. Ela
 * NÃO é ecoada em nenhum momento — nem no resumo final.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { AppModule } from '../src/app.module';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../src/contexts/account/application/ports/output/account-repository.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../src/contexts/user/application/ports/output/user-repository.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../src/contexts/user/application/ports/output/password-hasher.port';
import { Account } from '../src/contexts/account/domain/entities/account.entity';
import { User } from '../src/contexts/user/domain/entities/user.entity';
import { Email } from '../src/shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../src/shared/domain/value-objects/phone-e164.vo';
import { PlainPassword } from '../src/shared/domain/value-objects/plain-password.vo';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(name: string): string {
  const value = arg(name);
  if (!value) {
    throw new Error(`Argumento --${name} é obrigatório.`);
  }
  return value;
}

async function main(): Promise<void> {
  const logger = new Logger('create-account');

  const name = required('name');
  const city = required('city');
  const ownerName = required('owner-name');
  const ownerEmail = required('owner-email');
  const ownerPhone = required('owner-phone');
  const ownerPassword = PlainPassword.create(required('owner-password'));

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const accounts = app.get<AccountRepositoryPort>(ACCOUNT_REPOSITORY);
    const users = app.get<UserRepositoryPort>(USER_REPOSITORY);
    const hasher = app.get<PasswordHasherPort>(PASSWORD_HASHER);
    const orm = app.get(MikroORM);

    // Fora de uma requisição HTTP não existe o fork do EntityManager que o MikroORM exige — quem
    // o cria numa rota é o `registerRequestContext` do PersistenceModule. Aqui, o script cria.
    await RequestContext.create(orm.em, async () => {
      const email = Email.create(ownerEmail);
      if (await users.findByEmailGlobally(email)) {
        throw new Error('Já existe um usuário com este e-mail.');
      }

      const account = await accounts.save(Account.create({ name, city }));

      const passwordHash = await ownerPassword.use((plain) => hasher.hash(plain));
      const owner = await users.save(
        User.create({
          accountId: account.id,
          name: ownerName,
          email,
          phone: PhoneE164.create(ownerPhone),
          passwordHash,
          role: 'owner',
          // Único caso em que a troca no primeiro login não é exigida: a senha foi escolhida por
          // quem vai usá-la, e não por um terceiro.
          mustChangePassword: false,
        }),
      );

      logger.log(`Conta criada: ${account.name} (${account.id.value})`);
      logger.log(`Dono criado: ${owner.name} <${owner.email.value}> (${owner.id.value})`);
      logger.log('Próximo passo: configurar as janelas de funcionamento e cadastrar as máquinas.');
    });
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`❌ ${(error as Error).message}`);
  process.exit(1);
});
