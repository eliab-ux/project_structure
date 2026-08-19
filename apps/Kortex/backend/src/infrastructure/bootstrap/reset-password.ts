/**
 * Senha temporária para um usuário que perdeu o acesso.
 *
 *   node dist/infrastructure/bootstrap/reset-password.js --email gleidson@corteceres.com.br
 *
 * Existe para o caso em que a recuperação normal não alcança: o canal do WhatsApp ainda não está
 * configurado, ou quem esqueceu é o próprio dono e não há mais ninguém com acesso. **Não é o
 * caminho padrão** — o padrão é o código de 6 dígitos que o usuário pede sozinho, e este script
 * não substitui a configuração do Evolution.
 *
 * Passa pelo domínio (`resetPasswordByOperator`) e pelo repositório, nunca por SQL direto. Um
 * `update` à mão na tabela é como se grava a senha em claro na coluna do hash por engano — e o
 * sintoma disso é "a senha certa não funciona", sem nada no log explicando.
 *
 * A senha resultante **sempre** exige troca no primeiro login: ela passou por um terceiro e por um
 * terminal, então vale um acesso.
 */
import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { AppModule } from '../../app.module';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../contexts/user/application/ports/output/user-repository.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../contexts/user/application/ports/output/password-hasher.port';
import { Email } from '../../shared/domain/value-objects/email.vo';
import { PlainPassword } from '../../shared/domain/value-objects/plain-password.vo';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** 18 caracteres em base64url, de `randomBytes`. Nunca `Math.random()`, que é previsível. */
function generatePassword(): string {
  return randomBytes(18).toString('base64url').slice(0, 18);
}

async function main(): Promise<void> {
  const logger = new Logger('reset-password');

  const emailArg = arg('email');
  if (!emailArg) {
    throw new Error('Argumento --email é obrigatório.');
  }

  const informed = arg('password');
  const plain = informed ?? generatePassword();
  const password = PlainPassword.create(plain);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const users = app.get<UserRepositoryPort>(USER_REPOSITORY);
    const hasher = app.get<PasswordHasherPort>(PASSWORD_HASHER);
    const orm = app.get(MikroORM);

    await RequestContext.create(orm.em, async () => {
      const email = Email.create(emailArg);

      // `findByEmailGlobally` porque não há conta em mãos — é a mesma exceção declarada do login,
      // e aqui quem executa é quem administra o servidor.
      const user = await users.findByEmailGlobally(email);
      if (!user) {
        throw new Error(`Nenhum usuário com o e-mail ${email.value}.`);
      }
      if (!user.isActive) {
        // Redefinir a senha de um usuário desligado o traria de volta em silêncio. Reative
        // primeiro, pela tela de Equipe, para a decisão ficar registrada onde alguém a vê.
        throw new Error(`O usuário ${email.value} está inativo. Reative-o antes de redefinir.`);
      }

      const passwordHash = await password.use((value) => hasher.hash(value));
      user.resetPasswordByOperator(passwordHash);
      await users.save(user);

      logger.log(`Senha redefinida: ${user.name} <${user.email.value}> (${user.role})`);

      // stdout e não o logger: logger de produção agrega, e senha temporária não pode acabar num
      // coletor de logs. Só é impressa quando foi GERADA aqui.
      if (!informed) {
        // eslint-disable-next-line no-console
        console.log(
          [
            '',
            '  ┌─────────────────────────────────────────────────────────┐',
            '  │  SENHA TEMPORÁRIA — anote agora, não será mostrada de   │',
            '  │  novo. A troca é obrigatória no primeiro login.         │',
            '  └─────────────────────────────────────────────────────────┘',
            '',
            `      ${plain}`,
            '',
          ].join('\n'),
        );
      }

      logger.warn(
        'Isto é contorno, não o caminho normal. Configure EVOLUTION_SYSTEM_INSTANCE e ' +
          'EVOLUTION_SYSTEM_APIKEY para a recuperação voltar a ser self-service pelo WhatsApp.',
      );
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
