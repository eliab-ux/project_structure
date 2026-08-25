/* eslint-disable */
// Dispara os jobs do Instagram AGORA, para cada tenant realmente conectado (lê do banco,
// igual ao scheduler faz — mas sem esperar o cron). Os workers rodam DENTRO do backend,
// então o backend precisa estar no ar. Requer Redis em 127.0.0.1:6379.
//
// Uso:  node scripts/run-jobs-now.js
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { Queue } = require('bullmq');

// .env loader mínimo
for (const l of fs.readFileSync(path.resolve(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
};

(async () => {
  // 1) Descobre os tenants conectados (mesma fonte do scheduler)
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const { rows: tenants } = await db.query(
    "SELECT owner_id AS \"ownerId\", ig_user_id AS \"igUserId\", username FROM instagram_connection WHERE status = 'connected'",
  );
  await db.end();

  if (tenants.length === 0) {
    console.log('Nenhum tenant conectado. Conecte um Instagram primeiro.');
    process.exit(0);
  }
  console.log(`Tenants conectados: ${tenants.map((t) => '@' + t.username).join(', ')}`);

  // 2) Enfileira por tenant. sync-media/resolve/reconcile agora; insights com atraso
  //    (espera a sincronização das mídias terminar antes de capturar métricas).
  const qSync = new Queue('ig-sync-media', { connection });
  const qResolve = new Queue('ig-resolve-watchlist', { connection });
  const qReconcile = new Queue('ig-reconcile-mentions', { connection });
  const qInsights = new Queue('ig-capture-insights', { connection });
  const qRefresh = new Queue('ig-refresh-token', { connection });

  for (const t of tenants) {
    const data = { ownerId: t.ownerId, igUserId: t.igUserId };
    const opts = { attempts: 2, removeOnComplete: 50, removeOnFail: 100 };
    await qSync.add('sync-media', data, opts);
    await qResolve.add('resolve-watchlist', data, opts);
    await qReconcile.add('reconcile-mentions', data, opts);
    await qInsights.add('capture-insights', data, { ...opts, delay: 20000 });
    await qRefresh.add('refresh-token', data, opts);
  }
  console.log('Jobs enfileirados. Acompanhe os logs do backend (os workers processam lá).');

  // 3) Aguarda e reporta o placar das filas
  await new Promise((r) => setTimeout(r, 25000));
  for (const q of [qSync, qResolve, qReconcile, qInsights, qRefresh]) {
    const c = await q.getJobCounts('completed', 'failed', 'active', 'waiting', 'delayed');
    console.log(
      `${q.name.padEnd(24)} completed=${c.completed} failed=${c.failed} active=${c.active} waiting=${c.waiting} delayed=${c.delayed}`,
    );
  }

  await Promise.all([qSync, qResolve, qReconcile, qInsights, qRefresh].map((q) => q.close()));
  console.log('DONE');
  process.exit(0);
})().catch((e) => {
  console.error('ERRO:', e && e.message ? e.message : e);
  process.exit(1);
});
