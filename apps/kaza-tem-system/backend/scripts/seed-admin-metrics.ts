import { Client } from 'pg';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

config({ path: '.env' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const email = 'test-admin-metrics@kazatem.shop';
  let userId = uuidv4();
  const resellerCode = `TEST_METRICS_${Date.now()}`;
  const uniqueLink = `test-metrics-${Date.now()}`;

  try {
    await client.query('BEGIN');

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    const existingUserCount = existingUser.rowCount ?? 0;
    if (existingUserCount > 0) {
      userId = existingUser.rows[0].id;
    } else {
      await client.query(
        `
        INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'reseller', NOW(), NOW())
      `,
        [userId, email, 'Teste Admin Métricas', 'seeded-hash'],
      );
    }

    const resellerResult = await client.query('SELECT id FROM resellers WHERE user_id = $1', [
      userId,
    ]);
    const resellerCount = resellerResult.rowCount ?? 0;
    let resellerId: string;
    if (resellerCount > 0) {
      resellerId = resellerResult.rows[0].id;
      await client.query(
        'UPDATE resellers SET reseller_code = $1, unique_link = $2, status = $3, updated_at = NOW() WHERE id = $4',
        [resellerCode, uniqueLink, 'active', resellerId],
      );
    } else {
      resellerId = uuidv4();
      await client.query(
        `
        INSERT INTO resellers (
          id, user_id, full_name, cpf, reseller_code, unique_link, level, status, total_sold_year, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'gold', 'active', 0, NOW(), NOW())
      `,
        [resellerId, userId, 'Teste Métricas', '00000000000', resellerCode, uniqueLink],
      );
    }

    const productId = uuidv4();
    await client.query(
      `
      INSERT INTO products (id, bling_id, sku, name, price, stock, is_active, created_at, updated_at)
      VALUES ($1, 'TEST-BLING', 'TEST-SKU', 'Produto Métrica', 99.9, 50, true, NOW(), NOW())
    `,
      [productId],
    );

    const orders = [
      { total: 250, status: 'paid' },
      { total: 420, status: 'paid' },
      { total: 100, status: 'canceled' },
    ];

    for (const [index, order] of orders.entries()) {
      const orderId = uuidv4();
      await client.query(
        `
        INSERT INTO orders (
          id, order_number, reseller_id, reseller_code, customer_name, customer_email, customer_cpf,
          subtotal, total_amount, status, created_at, updated_at, paid_at, shipping_cost
        ) VALUES (
          $1, $2, $3, $4, 'Cliente Teste', 'cliente.test${index}@example.com', '12345678901',
          $5, $5, $6, NOW(), NOW(), NOW(), 0
        );
      `,
        [
          orderId,
          `TEST-ORDER-${Date.now()}-${index}`,
          resellerId,
          resellerCode,
          order.total,
          order.status,
        ],
      );

      await client.query(
        `
        INSERT INTO order_items (
          id, order_id, product_id, product_name, product_sku, quantity, unit_price, total_price
        ) VALUES ($1, $2, $3, 'Produto Métrica', 'TEST-SKU', 1, $4, $4);
      `,
        [uuidv4(), orderId, productId, order.total],
      );
    }

    await client.query(
      `
      INSERT INTO withdrawals (
        id, reseller_id, amount, status, created_at, updated_at
      ) VALUES ($1, $2, 150, 'requested', NOW(), NOW())
    `,
      [uuidv4(), resellerId],
    );

    await client.query('COMMIT');
    console.log('Seed de métricas aplicada com sucesso.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Falha ao aplicar seed de métricas:', error);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
