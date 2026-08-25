/* eslint-disable */
// Enqueues one job into each Ecoa queue and reports whether the workers (running inside the
// backend process) consumed them. Validates the BullMQ wiring end-to-end.
const { Queue } = require('bullmq');

const QUEUES = [
  'ig-refresh-token',
  'ig-sync-media',
  'ig-capture-insights',
  'ig-resolve-watchlist',
  'ig-reconcile-mentions',
];
const connection = { host: '127.0.0.1', port: 6379 };

(async () => {
  const queues = QUEUES.map((name) => new Queue(name, { connection }));

  for (const q of queues) {
    await q.add('manual-test', { ownerId: '00000000-0000-4000-8000-000000000000', igUserId: 'x' });
  }
  console.log('Enfileirado 1 job em cada fila. Aguardando os workers...');

  await new Promise((r) => setTimeout(r, 7000));

  for (const q of queues) {
    const c = await q.getJobCounts('completed', 'failed', 'active', 'waiting', 'delayed');
    console.log(
      `${q.name.padEnd(24)} completed=${c.completed} failed=${c.failed} active=${c.active} waiting=${c.waiting}`,
    );
  }

  await Promise.all(queues.map((q) => q.close()));
  console.log('DONE');
  process.exit(0);
})().catch((e) => {
  console.error('ENQUEUE_ERROR:', e && e.message ? e.message : e);
  process.exit(1);
});
