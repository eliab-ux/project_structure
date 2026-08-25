import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import {
  AdminTopProduct,
  AdminTopReseller,
  SalesChartPoint,
} from '../application/dto/admin-metrics.dto';

@Injectable()
export class AdminMetricsRepository {
  constructor(private readonly em: EntityManager) {}

  async sumTotalSince(start: Date): Promise<number> {
    const knex = this.em.getKnex();
    const result = await knex.raw(
      'SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE created_at >= ? AND status != ?',
      [start.toISOString(), 'canceled'],
    );
    return this.toNumber(result.rows, 0, 'total');
  }

  async countOrdersSince(start: Date): Promise<number> {
    const knex = this.em.getKnex();
    const result = await knex.raw(
      'SELECT COUNT(*) AS count FROM orders WHERE created_at >= ? AND status != ?',
      [start.toISOString(), 'canceled'],
    );
    return this.toNumber(result.rows, 0, 'count');
  }

  async countResellersByStatus(status: string): Promise<number> {
    if (!status) {
      return 0;
    }
    const knex = this.em.getKnex();
    const result = await knex.raw('SELECT COUNT(*) AS count FROM resellers WHERE status = ?', [
      status,
    ]);
    return this.toNumber(result.rows, 0, 'count');
  }

  async countWithdrawalsByStatus(status: string): Promise<number> {
    if (!status) {
      return 0;
    }
    const knex = this.em.getKnex();
    const result = await knex.raw('SELECT COUNT(*) AS count FROM withdrawals WHERE status = ?', [
      status,
    ]);
    return this.toNumber(result.rows, 0, 'count');
  }

  async fetchSalesChart(start: Date): Promise<SalesChartPoint[]> {
    const knex = this.em.getKnex();
    const result = await knex.raw(
      `
        SELECT
          date_trunc('day', created_at) AS day,
          COALESCE(SUM(total_amount), 0) AS amount,
          COUNT(*) AS orders
        FROM orders
        WHERE status != ? AND created_at >= ?
        GROUP BY day
        ORDER BY day ASC
      `,
      ['canceled', start.toISOString()],
    );

    return (result.rows as Array<{ day: string; amount: number; orders: number }>).map((row) => ({
      date: new Date(row.day).toISOString().split('T')[0],
      amount: Number(row.amount),
      orders: Number(row.orders),
    }));
  }

  async fetchTopResellers(limit = 5): Promise<AdminTopReseller[]> {
    const knex = this.em.getKnex();
    const result = await knex.raw(
      `
        SELECT
          r.id,
          r.full_name AS name,
          r.level,
          COALESCE(SUM(o.total_amount), 0) AS total_sold
        FROM resellers r
        LEFT JOIN orders o ON o.reseller_id = r.id AND o.status != ?
        WHERE r.status = ?
        GROUP BY r.id, r.full_name, r.level
        ORDER BY total_sold DESC
        LIMIT ?
      `,
      ['canceled', 'active', limit],
    );
    return (
      result.rows as Array<{ id: string; name: string; level: string; total_sold: number }>
    ).map((row) => ({
      id: row.id,
      name: row.name,
      level: row.level,
      totalSold: Number(row.total_sold),
    }));
  }

  async fetchTopProducts(limit = 5): Promise<AdminTopProduct[]> {
    const knex = this.em.getKnex();
    const result = await knex.raw(
      `
        SELECT
          p.id,
          p.name,
          COALESCE(SUM(oi.quantity), 0) AS quantity,
          COALESCE(SUM(oi.total_price), 0) AS revenue
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status != ?
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT ?
      `,
      ['canceled', limit],
    );
    return (
      result.rows as Array<{ id: string; name: string; quantity: number; revenue: number }>
    ).map((row) => ({
      id: row.id,
      name: row.name,
      quantity: Number(row.quantity),
      revenue: Number(row.revenue),
    }));
  }

  private toNumber(
    rows: Array<Record<string, unknown>> | [],
    defaultValue: number,
    column: string,
  ): number {
    const value = (rows as Array<Record<string, unknown>>)[0]?.[column];
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
}
