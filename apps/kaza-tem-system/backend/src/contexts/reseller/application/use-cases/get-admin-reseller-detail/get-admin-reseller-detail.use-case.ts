import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { GetAdminResellerDetailQuery } from './get-admin-reseller-detail.query';
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
import { AdminResellerDetailDto } from '../../dto/admin-reseller-detail.dto';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepositoryPort,
} from '@contexts/subscription/application/ports/output/subscription-repository.port';
import {
  WITHDRAWAL_REPOSITORY,
  WithdrawalRepositoryPort,
} from '@contexts/withdrawal/application/ports/output/withdrawal-repository.port';
import { WithdrawalDto } from '@contexts/withdrawal/application/dto/withdrawal.dto';

@Injectable()
export class GetAdminResellerDetailUseCase
  implements UseCase<GetAdminResellerDetailQuery, AdminResellerDetailDto>
{
  constructor(
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    @Inject(COMMISSION_REPOSITORY)
    private readonly commissionRepository: CommissionRepositoryPort,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: SubscriptionRepositoryPort,
    @Inject(WITHDRAWAL_REPOSITORY)
    private readonly withdrawalRepository: WithdrawalRepositoryPort,
  ) {}

  async execute(query: GetAdminResellerDetailQuery): Promise<AdminResellerDetailDto> {
    const resellerId = ResellerId.from(query.resellerId);
    const reseller = await this.resellerRepository.findById(resellerId);

    if (!reseller) {
      throw new NotFoundException('Revendedor não encontrado');
    }

    const [
      user,
      monthlySales,
      balance,
      totalOrders,
      ordersLast30Days,
      subscription,
      withdrawals,
    ] = await Promise.all([
      this.userRepository.findById(UserId.from(reseller.userId)),
      this.commissionRepository.getResellerMonthlySales(reseller.id.value),
      this.commissionRepository.getBalance(reseller.id.value),
      this.orderRepository.countByResellerId(reseller.id.value),
      this.orderRepository.countByResellerIdSince(reseller.id.value, this.daysAgo(30)),
      this.subscriptionRepository.findByResellerId(reseller.id.value),
      this.withdrawalRepository.findByReseller(ResellerId.from(reseller.id.value)),
    ]);

    const withdrawalDtos = withdrawals.slice(0, 5).map((withdrawal) =>
      WithdrawalDto.fromDomain(withdrawal),
    );

    const subscriptionInfo = subscription
      ? {
          status: subscription.status.value,
          amount: subscription.amount,
          nextBillingDate: subscription.nextBillingDate,
        }
      : null;

    const detail = AdminResellerDetailDto.fromData({
      resellerId: reseller.id.value,
      fullName: reseller.fullName,
      cpf: reseller.cpf.value,
      uniqueLink: reseller.uniqueLink.value,
      status: reseller.status.value,
      level: reseller.level.value,
      phone: reseller.phone,
      approvedAt: reseller.approvedAt,
      approvedBy: reseller.approvedBy,
      suspendedAt: reseller.suspendedAt,
      suspensionReason: reseller.suspensionReason,
      totalSoldYear: reseller.totalSoldYear,
      createdAt: reseller.createdAt,
      updatedAt: reseller.updatedAt,
      userName: user?.name ?? null,
      userEmail: user?.email?.value ?? null,
      bank: {
        bankName: reseller.bankName,
        bankCode: reseller.bankCode,
        bankAgency: reseller.bankAgency,
        bankAccount: reseller.bankAccount,
        bankAccountType: reseller.bankAccountType,
        bankHolderName: reseller.bankHolderName,
        bankHolderCpf: reseller.bankHolderCpf,
        pixKey: reseller.pixKey,
        pixKeyType: reseller.pixKeyType,
      },
      subscription: subscriptionInfo,
      metrics: {
        totalOrders,
        ordersLast30Days,
        monthlySales,
        balance,
      },
      withdrawals: withdrawalDtos,
    });

    return detail;
  }

  private daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }
}
