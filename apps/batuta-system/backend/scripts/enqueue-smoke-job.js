/**
 * FASE 0 smoke test: enqueues one job on `batuta-smoke-test` so you can confirm Redis +
 * BullMQ are wired. Run the API (`npm run dev`) and then `npm run smoke:queue` — the worker
 * logs "Smoke-test job processado".
 *
 * Reads the same REDIS_* variables as the app.
 */
try {
  // dotenv comes in transitively with @nestjs/config; if absent, rely on the shell env.
  require('dotenv').config();
} catch {
  /* optional */
}
const { Queue } = require('bullmq');

const QUEUE_SMOKE_TEST = 'batuta-smoke-test';

async function main() {
  const queue = new Queue(QUEUE_SMOKE_TEST, {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      username: process.env.REDIS_USERNAME || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
    },
  });

  const job = await queue.add('smoke', { label: `cli-${new Date().toISOString()}` });
  console.log(`Job enfileirado: ${job.id} na fila ${QUEUE_SMOKE_TEST}`);
  await queue.close();
}

main().catch((error) => {
  console.error('Falha ao enfileirar job de smoke test:', error.message);
  process.exit(1);
});
