import { AdminTopProduct, AdminTopReseller } from '@contexts/analytics/application/dto/admin-metrics.dto';
import { GetAdminMetricsUseCase } from '@contexts/analytics/application/use-cases/get-admin-metrics/get-admin-metrics.use-case';
import { GetAdminMetricsQuery } from '@contexts/analytics/application/use-cases/get-admin-metrics/get-admin-metrics.query';

class FakeAdminMetricsRepository {
  async sumTotalSince(): Promise<number> {
    return 1000;
  }

  async countOrdersSince(): Promise<number> {
    return 25;
  }

  async countResellersByStatus(status: string): Promise<number> {
    return status === 'active' ? 8 : 3;
  }

  async countWithdrawalsByStatus(): Promise<number> {
    return 1;
  }

  async fetchSalesChart(): Promise<Array<{ date: string; amount: number; orders: number }>> {
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(now.getDate() - 2);
    return [
      {
        date: twoDaysAgo.toISOString().split('T')[0],
        amount: 240,
        orders: 4,
      },
      {
        date: now.toISOString().split('T')[0],
        amount: 520,
        orders: 5,
      },
    ];
  }

  async fetchTopResellers(): Promise<AdminTopReseller[]> {
    return [
      { id: 'r1', name: 'Ana', level: 'gold', totalSold: 1500.456 },
      { id: 'r2', name: 'Bruno', level: 'silver', totalSold: 890.34 },
    ];
  }

  async fetchTopProducts(): Promise<AdminTopProduct[]> {
    return [
      { id: 'p1', name: 'Produto A', quantity: 20, revenue: 1200 },
      { id: 'p2', name: 'Produto B', quantity: 5, revenue: 400 },
    ];
  }
}

describe('GetAdminMetricsUseCase', () => {
  const useCase = new GetAdminMetricsUseCase(new FakeAdminMetricsRepository() as any);

  it('produces value objects matching the DTO contract', async () => {
    const result = await useCase.execute(new GetAdminMetricsQuery());

    expect(result.salesToday).toBeCloseTo(1000);
    expect(result.salesWeek).toBeCloseTo(1000);
    expect(result.salesMonth).toBeCloseTo(1000);
    expect(result.ordersToday).toBe(25);
    expect(result.averageTicket).toBeCloseTo(1000 / 25);
    expect(result.activeResellers).toBe(8);
    expect(result.pendingRegistrations).toBe(3);
    expect(result.pendingWithdrawals).toBe(1);
    expect(result.topResellers).toHaveLength(2);
    expect(result.topProducts[0].name).toBe('Produto A');
    expect(result.topProducts[0].revenue).toBeCloseTo(1200);
  });

  it('builds a 30-day sales chart and preserves provided entries', async () => {
    const result = await useCase.execute(new GetAdminMetricsQuery());
    expect(result.salesChart).toHaveLength(30);
    const latest = result.salesChart[result.salesChart.length - 1];
    expect(latest.orders).toBe(5);
    expect(latest.amount).toBe(520);
    const twoDaysAgoPoint = result.salesChart[result.salesChart.length - 3];
    expect(twoDaysAgoPoint.orders).toBe(4);
  });
});
