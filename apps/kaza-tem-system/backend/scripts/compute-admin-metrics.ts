import { Client } from 'pg';
import { config } from 'dotenv';

config({ path: '.env' });

async function queryNumber(client: Client, text: string, params: unknown[], column: string) {
  const result = await client.query(text, params);
  const value = result.rows[0]?.[column];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const salesToday = await queryNumber(
      client,
      'SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE created_at >= $1 AND status != $2',
      [today, 'canceled'],
      'total',
    );

    const salesWeek = await queryNumber(
      client,
      'SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE created_at >= $1 AND status != $2',
      [weekAgo, 'canceled'],
      'total',
    );

    const salesMonth = await queryNumber(
      client,
      'SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE created_at >= $1 AND status != $2',
      [month, 'canceled'],
      'total',
    );

    const ordersToday = await queryNumber(
      client,
      'SELECT COUNT(*) AS count FROM orders WHERE created_at >= $1 AND status != $2',
      [today, 'canceled'],
      'count',
    );

    const ordersMonth = await queryNumber(
      client,
      'SELECT COUNT(*) AS count FROM orders WHERE created_at >= $1 AND status != $2',
      [month, 'canceled'],
      'count',
    );

    const activeResellers = await queryNumber(
      client,
      'SELECT COUNT(*) AS count FROM resellers WHERE status = $1',
      ['active'],
      'count',
    );

    const pendingRegistrations = await queryNumber(
      client,
      'SELECT COUNT(*) AS count FROM resellers WHERE status = $1',
      ['pending'],
      'count',
    );

    const pendingWithdrawals = await queryNumber(
      client,
      'SELECT COUNT(*) AS count FROM withdrawals WHERE status = $1',
      ['requested'],
      'count',
    );

    const salesChart = await client.query(
      `
      SELECT
        date_trunc('day', created_at) AS day,
        COALESCE(SUM(total_amount), 0) AS amount,
        COUNT(*) AS orders
      FROM orders
      WHERE status != $1 AND created_at >= $2
      GROUP BY day
      ORDER BY day ASC
    `,
      ['canceled', weekAgo],
    );

    const topResellers = await client.query(
      `
      SELECT
        r.id,
        r.full_name AS name,
        r.level,
        COALESCE(SUM(o.total_amount), 0) AS total_sold
      FROM resellers r
      LEFT JOIN orders o ON o.reseller_id = r.id AND o.status != $1
      WHERE r.status = 'active'
      GROUP BY r.id, r.full_name, r.level
      ORDER BY total_sold DESC
      LIMIT 5;
    `,
      ['canceled'],
    );

    const topProducts = await client.query(
      `
      SELECT
        p.id,
        p.name,
        COALESCE(SUM(oi.quantity), 0) AS quantity,
        COALESCE(SUM(oi.total_price), 0) AS revenue
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status != $1
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT 5;
    `,
      ['canceled'],
    );

    console.log({
      salesToday,
      salesWeek,
      salesMonth,
      ordersToday,
      ordersMonth,
      averageTicket: ordersMonth > 0 ? salesMonth / ordersMonth : 0,
      activeResellers,
      pendingRegistrations,
      pendingWithdrawals,
      salesChart: salesChart.rows,
      topResellers: topResellers.rows,
      topProducts: topProducts.rows,
    });
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Erro ao calcular métricas:', error);
  process.exit(1);
});
