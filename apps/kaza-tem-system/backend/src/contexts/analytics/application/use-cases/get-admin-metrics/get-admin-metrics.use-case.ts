import { Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { AdminMetricsDto } from '../../dto/admin-metrics.dto';
import { GetAdminMetricsQuery } from './get-admin-metrics.query';
import { AdminMetricsRepository } from '../../../infrastructure/admin-metrics.repository';

@Injectable()
export class GetAdminMetricsUseCase implements UseCase<GetAdminMetricsQuery, AdminMetricsDto> {
  constructor(private readonly repository: AdminMetricsRepository) {}

  async execute(_command: GetAdminMetricsQuery): Promise<AdminMetricsDto> {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const chartStart = new Date(now);
    chartStart.setDate(chartStart.getDate() - 29);
    chartStart.setHours(0, 0, 0, 0);

    const [
      salesToday,
      salesWeek,
      salesMonth,
      ordersToday,
      ordersMonth,
      activeResellers,
      pendingRegistrations,
      pendingWithdrawals,
      salesChartRows,
      topResellers,
      topProducts,
    ] = await Promise.all([
      this.repository.sumTotalSince(startOfToday),
      this.repository.sumTotalSince(startOfWeek),
      this.repository.sumTotalSince(startOfMonth),
      this.repository.countOrdersSince(startOfToday),
      this.repository.countOrdersSince(startOfMonth),
      this.repository.countResellersByStatus('active'),
      this.repository.countResellersByStatus('pending'),
      this.repository.countWithdrawalsByStatus('requested'),
      this.repository.fetchSalesChart(chartStart),
      this.repository.fetchTopResellers(),
      this.repository.fetchTopProducts(),
    ]);

    const salesChart = this.buildChart(salesChartRows, chartStart);

    const averageTicket = ordersMonth > 0 ? salesMonth / ordersMonth : 0;

    return AdminMetricsDto.fromData({
      salesToday,
      salesWeek,
      salesMonth,
      ordersToday,
      ordersMonth,
      averageTicket,
      activeResellers,
      pendingRegistrations,
      pendingWithdrawals,
      salesChart,
      topResellers,
      topProducts,
    });
  }

  private buildChart(rows: Array<{ date: string; amount: number; orders: number }>, start: Date) {
    const map = new Map(rows.map((row) => [row.date, row]));
    return Array.from({ length: 30 }, (_, index) => {
      const current = new Date(start);
      current.setDate(current.getDate() + index);
      const isoDate = current.toISOString().split('T')[0];
      const existing = map.get(isoDate);
      return {
        date: isoDate,
        amount: existing?.amount ?? 0,
        orders: existing?.orders ?? 0,
      };
    });
  }
}
