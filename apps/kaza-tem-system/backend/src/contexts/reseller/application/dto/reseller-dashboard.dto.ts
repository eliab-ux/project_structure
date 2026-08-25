export interface ResellerDashboardMetrics {
  totalSold: string;
  commission: string;
  visits: string;
  conversion: string;
}

export interface ResellerDashboardCard {
  label: string;
  detail: string;
}

export class ResellerDashboardDto {
  user!: { name: string };
  reseller!: {
    id: string;
    level: string;
    uniqueLink: string;
    status: string;
  };
  metrics!: ResellerDashboardMetrics;
  nextLevelProgress!: number;
  cards!: ResellerDashboardCard[];

  static fromData(params: {
    userName: string;
    resellerId: string;
    level: string;
    uniqueLink: string;
    status: string;
    metrics: ResellerDashboardMetrics;
    nextLevelProgress: number;
    cards: ResellerDashboardCard[];
  }): ResellerDashboardDto {
    const dto = new ResellerDashboardDto();
    dto.user = { name: params.userName };
    dto.reseller = {
      id: params.resellerId,
      level: params.level,
      uniqueLink: params.uniqueLink,
      status: params.status,
    };
    dto.metrics = params.metrics;
    dto.nextLevelProgress = params.nextLevelProgress;
    dto.cards = params.cards;
    return dto;
  }
}
