import { config as loadEnv } from 'dotenv';

/**
 * Side-effect module: makes an operator CLI connect as the OWNER role.
 *
 * **Must be the FIRST import of any CLI that touches the AppModule**, and it exists as its own file
 * precisely because of that ordering. `import` statements are hoisted and executed in order, so an
 * assignment written inline in the CLI file would run only after `app.module.ts` had already been
 * required — and `ConfigModule.forRoot()` loads the `.env` synchronously at that moment. The swap
 * would happen too late and the CLI would connect as the runtime role.
 *
 * Why the owner at all: the onboarding writes rows for a tenant that does not exist yet, so there
 * is no scope to establish and RLS would reject every INSERT under `veertex_app`. Failing that way
 * produces "new row violates row-level security policy", which explains nothing to whoever ran the
 * command.
 *
 * `override: false` keeps a value exported in the shell winning over the file — what a deploy needs.
 */
loadEnv({ override: false });

if (process.env.DATABASE_URL_MIGRATIONS) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_MIGRATIONS;
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '⚠️  DATABASE_URL_MIGRATIONS ausente: o comando vai conectar com DATABASE_URL. Se esse for o ' +
      'usuário de runtime, o RLS recusará as escritas do onboarding.',
  );
}
