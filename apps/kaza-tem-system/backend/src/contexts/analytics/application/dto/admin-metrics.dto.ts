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

export class AdminMetricsDto {
  salesToday!: number;
  salesWeek!: number;
  salesMonth!: number;
  ordersToday!: number;
  ordersMonth!: number;
  averageTicket!: number;
  activeResellers!: number;
  pendingRegistrations!: number;
  pendingWithdrawals!: number;
  salesChart!: SalesChartPoint[];
  topResellers!: AdminTopReseller[];
  topProducts!: AdminTopProduct[];

  static fromData(params: {
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
  }): AdminMetricsDto {
    const dto = new AdminMetricsDto();
    dto.salesToday = Number(params.salesToday.toFixed(2));
    dto.salesWeek = Number(params.salesWeek.toFixed(2));
    dto.salesMonth = Number(params.salesMonth.toFixed(2));
    dto.ordersToday = params.ordersToday;
    dto.ordersMonth = params.ordersMonth;
    dto.averageTicket = Number(params.averageTicket.toFixed(2));
    dto.activeResellers = params.activeResellers;
    dto.pendingRegistrations = params.pendingRegistrations;
    dto.pendingWithdrawals = params.pendingWithdrawals;
    dto.salesChart = params.salesChart;
    dto.topResellers = params.topResellers.map((reseller) => ({
      ...reseller,
      totalSold: Number(reseller.totalSold.toFixed(2)),
    }));
    dto.topProducts = params.topProducts.map((product) => ({
      ...product,
      revenue: Number(product.revenue.toFixed(2)),
    }));
    return dto;
  }
}
