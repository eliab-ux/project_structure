import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { MikroORM } from '@mikro-orm/postgresql';
import * as bcrypt from 'bcryptjs';
import { assertStrongPassword } from '../../../contexts/auth/domain/password-policy';
import { createMikroOrmConfig } from './config/mikro-orm.config';
import { PlatformAdminOrmEntity } from './entities/platform-admin-orm.entity';

/**
 * Creates the FIRST platform admin — the one account that cannot be created through the product.
 *
 * It has to exist as a script because of a genuine chicken-and-egg: platform admins are who create
 * tenants, so there is nobody logged in to create the first one. Everything else in the system is
 * reachable from a screen; this is not, and pretending otherwise would mean an endpoint that mints
 * platform admins — the single worst thing to leave exposed on the internet.
 *
 * Runs from COMPILED code (`dist/`) for the same reason `migrate.ts` does: the production image has
 * no TypeScript and no dev dependencies, and adding them to run one command would make production
 * depend on a toolchain the application never uses.
 *
 *   ADMIN_NAME="Eliab" ADMIN_EMAIL="eu@exemplo.com" ADMIN_PASSWORD="..." npm run admin:create
 *
 * Cost 12 for the hash, matching BcryptPasswordHasher — a weaker hash here would make the most
 * privileged account in the system the easiest one to crack offline.
 */
const SALT_ROUNDS = 12;

async function run(): Promise<void> {
  const name = (process.env.ADMIN_NAME ?? '').trim();
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  // Opt-in, and named for what it does. Without it an existing admin is never touched: a script that
  // silently overwrote a password would be a way to take over an account that already exists.
  const resetExisting = process.env.ADMIN_RESET_PASSWORD === 'true';

  if (!name || !email || !password) {
    throw new Error(
      'Informe ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD. Exemplo:\n' +
        '  ADMIN_NAME="Eliab" ADMIN_EMAIL="eu@exemplo.com" ADMIN_PASSWORD="..." npm run admin:create',
    );
  }
  if (!email.includes('@')) {
    throw new Error('ADMIN_EMAIL inválido.');
  }
  // Same policy the API enforces. The one account with no recovery flow is not the place to allow a
  // weak password "just this once".
  assertStrongPassword(password);

  // A bare ConfigService over process.env: in a container the environment IS the configuration.
  const config = new ConfigService(process.env);
  const orm = await MikroORM.init({ ...createMikroOrmConfig(config), connect: true });

  try {
    const em = orm.em.fork();
    const existing = await em.findOne(PlatformAdminOrmEntity, { email });

    if (existing && !resetExisting) {
      process.stdout.write(
        `Já existe um admin de plataforma com este e-mail (${email}). ` +
          'Para trocar a senha dele, rode de novo com ADMIN_RESET_PASSWORD=true.\n',
      );
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    if (existing) {
      await em.nativeUpdate(
        PlatformAdminOrmEntity,
        { id: existing.id },
        { passwordHash, active: true },
      );
      process.stdout.write(`Senha do admin de plataforma redefinida: ${email}\n`);
      return;
    }

    await em.insert(PlatformAdminOrmEntity, {
      id: randomUUID(),
      name,
      email,
      passwordHash,
      active: true,
      lastLoginAt: null,
      createdAt: new Date(),
    });
    // The password itself is never echoed: whoever ran the command already knows it, and a terminal
    // scrollback is not a place to leave it.
    process.stdout.write(`Admin de plataforma criado: ${email}\n`);
  } finally {
    await orm.close(true);
  }
}

run().catch((error: Error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
