import { adminFetch } from './adminApi';

export interface SalesChartPoint {
  date: string;
  amount: number;
  orders: number;
}

export interface AdminTopReseller {
  id: string;
  name: string;
  level: string;
  totalSold: number;
}

export interface AdminTopProduct {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface AdminMetrics {
  salesToday: number;
  salesWeek: number;
  salesMonth: number;
  ordersToday: number;
  ordersMonth: number;
  averageTicket: number;
  activeResellers: number;
  pendingRegistrations: number;
  pendingWithdrawals: number;
  salesChart: SalesChartPoint[];
  topResellers: AdminTopReseller[];
  topProducts: AdminTopProduct[];
}

export async function getAdminMetrics(token: string): Promise<AdminMetrics> {
  return adminFetch<AdminMetrics>(token, '/admin/dashboard/metrics');
}
