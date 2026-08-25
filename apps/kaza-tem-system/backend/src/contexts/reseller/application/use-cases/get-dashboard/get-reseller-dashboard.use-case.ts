import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { GetResellerDashboardQuery } from './get-reseller-dashboard.query';
import { ResellerDashboardDto } from '../../dto/reseller-dashboard.dto';
import {
  RESELLER_REPOSITORY,
  ResellerRepositoryPort,
} from '../../ports/output/reseller-repository.port';
import { ResellerId } from '../../../domain/value-objects/reseller-id.vo';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@contexts/user/application/ports/output/user-repository.port';
import { UserId } from '@contexts/user/domain/value-objects/user-id.vo';
import {
  ORDER_REPOSITORY,
  OrderRepositoryPort,
} from '@contexts/order/application/ports/output/order-repository.port';
import {
  COMMISSION_REPOSITORY,
  CommissionRepositoryPort,
} from '@contexts/commission/application/ports/output/commission-repository.port';
import { GetResellerBalanceUseCase } from '@contexts/commission/application/use-cases/get-reseller-balance/get-reseller-balance.use-case';
import {
  VISIT_REPOSITORY,
  VisitRepositoryPort,
} from '@contexts/analytics/application/ports/output/visit-repository.port';

@Injectable()
export class GetResellerDashboardUseCase implements UseCase<
  GetResellerDashboardQuery,
  ResellerDashboardDto
> {
  constructor(
    @Inject(RESELLER_REPOSITORY) private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepositoryPort,
    @Inject(COMMISSION_REPOSITORY) private readonly commissionRepository: CommissionRepositoryPort,
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepositoryPort,
    private readonly balanceUseCase: GetResellerBalanceUseCase,
  ) {}

  async execute(query: GetResellerDashboardQuery): Promise<ResellerDashboardDto> {
    const resellerId = ResellerId.from(query.resellerId);
    const reseller = await this.resellerRepository.findById(resellerId);
    if (!reseller) {
      throw new NotFoundException('Revendedor não encontrado');
    }

    const user = await this.userRepository.findById(UserId.from(reseller.userId));
    if (!user) {
      throw new NotFoundException('Usuário do revendedor não encontrado');
    }

    const [monthlySales, ordersCount, ordersLast30Days, visitsTotal, visitsLast30Days, balance] =
      await Promise.all([
        this.commissionRepository.getResellerMonthlySales(reseller.id.value),
        this.orderRepository.countByResellerId(reseller.id.value),
        this.orderRepository.countByResellerIdSince(reseller.id.value, this.daysAgo(30)),
        this.visitRepository.countByResellerId(reseller.id.value),
        this.visitRepository.countByResellerIdSince(reseller.id.value, this.daysAgo(30)),
        this.balanceUseCase.execute(reseller.id.value),
      ]);

    const currencyFormatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const numberFormatter = new Intl.NumberFormat('pt-BR');

    const conversionValue = visitsLast30Days > 0 ? (ordersLast30Days / visitsLast30Days) * 100 : 0;
    const conversionString = `${conversionValue.toFixed(1).replace('.', ',')}%`;

    const cards = [
      {
        label: 'Vendas confirmadas (30 dias)',
        detail: `${ordersLast30Days} pedidos`,
      },
      {
        label: 'Comissões pendentes',
        detail: currencyFormatter.format(balance.pending),
      },
      {
        label: 'Total de pedidos',
        detail: `${ordersCount} pedidos no total`,
      },
    ];

    const dto = ResellerDashboardDto.fromData({
      userName: user.name,
      resellerId: reseller.id.value,
      level: reseller.level.value,
      uniqueLink: reseller.uniqueLink.value,
      status: reseller.status.value,
      metrics: {
        totalSold: currencyFormatter.format(monthlySales),
        commission: currencyFormatter.format(balance.available),
        visits: numberFormatter.format(visitsTotal),
        conversion: conversionString,
      },
      nextLevelProgress: this.calculateLevelProgress(reseller.level.value, monthlySales),
      cards,
    });

    return dto;
  }

  private calculateLevelProgress(level: string, monthlySales: number): number {
    const projectedAnnual = monthlySales * 12;
    const normalized = level.toLowerCase();
    const thresholds: Record<string, { min: number; max: number }> = {
      bronze: { min: 0, max: 50_000 },
      prata: { min: 50_000, max: 150_000 },
      ouro: { min: 150_000, max: 300_000 },
    };

    if (normalized === 'ouro') {
      return 100;
    }

    const config = thresholds[normalized] ?? thresholds.bronze;
    const range = config.max - config.min;
    if (range <= 0) {
      return 0;
    }

    const progress = ((projectedAnnual - config.min) / range) * 100;
    return Math.min(100, Math.max(0, progress));
  }

  private daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }
}
