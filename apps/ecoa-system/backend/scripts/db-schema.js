/* eslint-disable */
// One-off: create/update the Ecoa schema in the configured Postgres (safe mode = no drops).
// Uses the compiled dist entities so it matches the running app exactly.
const fs = require('fs');
const path = require('path');
const { MikroORM, PostgreSqlDriver } = require('@mikro-orm/postgresql');

// Minimal .env loader (no dotenv dependency).
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) {
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
}

(async () => {
  loadEnv();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definido no .env');

  const orm = await MikroORM.init({
    driver: PostgreSqlDriver,
    clientUrl: process.env.DATABASE_URL,
    entities: ['dist/**/*.entity.js'],
    discovery: { warnWhenNoEntities: false },
    debug: false,
  });

  const generator = orm.getSchemaGenerator();
  // safe: true → never drops tables/columns; only creates what is missing.
  await generator.updateSchema({ safe: true });
  await orm.close(true);
  console.log('SCHEMA_UPDATED_OK');
})().catch((e) => {
  console.error('SCHEMA_ERROR:', e && e.message ? e.message : e);
  process.exit(1);
});
