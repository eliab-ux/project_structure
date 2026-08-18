/**
 * Bootstrap de produção: cria a conta e o seu primeiro usuário `owner`.
 *
 *   node dist/infrastructure/bootstrap/create-account.js \
 *     --name "Corte Ceres · APL" --city "Ceres" \
 *     --owner-name "Gleidson Dantas" --owner-email "gleidson@corteceres.com.br" \
 *     --owner-phone "62996010090"
 *
 * Existe porque **não há rota pública de cadastro de conta** — o Kortex é multiconta, mas cada
 * conta é uma operação real, criada por quem administra o servidor. Sem isto, um banco recém
 * migrado não teria ninguém para autenticar e nenhuma tela seria alcançável.
 *
 * Vive em `src/` (e não em `scripts/`, como o gêmeo de desenvolvimento) para ser **compilado**: a
 * imagem de produção não tem `ts-node`.
 *
 * Duas diferenças em relação ao script de desenvolvimento, e as duas são de segurança:
 *
 * 1. **`must_change_password` é sempre `true`.** Quem roda o deploy não é o dono da conta; a senha
 *    inicial passa por um terceiro e por um terminal, e não pode continuar valendo depois do
 *    primeiro acesso.
 * 2. **A senha é gerada aqui**, com `randomBytes`, quando não vem por argumento. Senha inventada
 *    na hora pelo operador é `Kortex@2026` — e essa é a senha da conta que controla o caixa. Ela é
 *    impressa UMA vez, no fim, e nunca é logada em outro lugar.
 */
import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { AppModule } from '../../app.module';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../contexts/account/application/ports/output/account-repository.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../contexts/user/application/ports/output/user-repository.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../contexts/user/application/ports/output/password-hasher.port';
import { Account, DEFAULT_TIMEZONE } from '../../contexts/account/domain/entities/account.entity';
import { User } from '../../contexts/user/domain/entities/user.entity';
import { Email } from '../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../shared/domain/value-objects/phone-e164.vo';
import { PlainPassword } from '../../shared/domain/value-objects/plain-password.vo';

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

/**
 * Senha temporária de 18 caracteres em base64url.
 *
 * `randomBytes` do `node:crypto`, nunca `Math.random()` — o mesmo motivo do código de recuperação
 * no WhatsApp: `Math.random` é previsível e não serve para gerar segredo. Sem `+`, `/` e `=` para
 * o operador conseguir copiar do terminal sem escapar nada.
 */
function generatePassword(): string {
  return randomBytes(18).toString('base64url').slice(0, 18);
}

async function main(): Promise<void> {
  const logger = new Logger('bootstrap');

  const name = required('name');
  const city = required('city');
  const timezone = arg('timezone') ?? DEFAULT_TIMEZONE;
  const ownerName = required('owner-name');
  const ownerEmail = required('owner-email');
  const ownerPhone = required('owner-phone');

  const informed = arg('owner-password');
  const plain = informed ?? generatePassword();
  const ownerPassword = PlainPassword.create(plain);

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

      const account = await accounts.save(Account.create({ name, city, timezone }));

      const passwordHash = await ownerPassword.use((value) => hasher.hash(value));
      const owner = await users.save(
        User.create({
          accountId: account.id,
          name: ownerName,
          email,
          phone: PhoneE164.create(ownerPhone),
          passwordHash,
          role: 'owner',
          // Sempre true no bootstrap: a senha inicial passou por um terceiro e por um terminal.
          mustChangePassword: true,
        }),
      );

      logger.log(`Conta criada: ${account.name} (${account.id.value})`);
      logger.log(`Fuso da operação: ${account.timezone}`);
      logger.log(`Dono criado: ${owner.name} <${owner.email.value}> (${owner.id.value})`);

      // A senha vai para stdout e não para o logger: logger de produção agrega, e senha temporária
      // não pode acabar num coletor de logs. Só é impressa quando foi GERADA aqui — se veio por
      // argumento, quem a escolheu já a tem.
      if (!informed) {
        // eslint-disable-next-line no-console
        console.log(
          [
            '',
            '  ┌─────────────────────────────────────────────────────────┐',
            '  │  SENHA TEMPORÁRIA — anote agora, não será mostrada de   │',
            '  │  novo. O dono é obrigado a trocá-la no primeiro login.  │',
            '  └─────────────────────────────────────────────────────────┘',
            '',
            `      ${plain}`,
            '',
          ].join('\n'),
        );
      }

      logger.log('Próximo passo: entrar, trocar a senha, configurar janelas e cadastrar máquinas.');
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
