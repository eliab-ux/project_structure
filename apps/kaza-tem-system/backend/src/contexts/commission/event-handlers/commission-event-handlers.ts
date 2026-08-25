import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderCanceledEvent } from '../../order/domain/events/order-canceled.event';
import { OrderPaidEvent } from '../../order/domain/events/order-paid.event';
import {
  COMMISSION_REPOSITORY,
  CommissionRepositoryPort,
} from '../application/ports/output/commission-repository.port';
import { CalculateCommissionForOrderUseCase } from '../application/use-cases/calculate-commission-for-order/calculate-commission-for-order.use-case';
import { CommissionStatus } from '../domain/value-objects/commission-status.vo';

@Injectable()
export class CommissionEventHandlers {
  constructor(
    private readonly calculateCommission: CalculateCommissionForOrderUseCase,
    @Inject(COMMISSION_REPOSITORY)
    private readonly commissionRepository: CommissionRepositoryPort,
  ) {}

  @OnEvent('order.paid')
  async handleOrderPaid(event: OrderPaidEvent) {
    if (!event.resellerId) {
      return;
    }

    await this.calculateCommission.execute({
      resellerId: event.resellerId,
      orderId: event.orderId,
      orderTotal: event.amount,
      shippingCost: event.shippingCost,
      discount: event.discount,
    });
  }

  @OnEvent('order.canceled')
  async handleOrderCanceled(event: OrderCanceledEvent) {
    const commission = await this.commissionRepository.findByOrderId(event.orderId);
    if (!commission) {
      return;
    }

    if (commission.status.value === CommissionStatus.PENDING.value) {
      await this.commissionRepository.deleteByOrderId(event.orderId);
      return;
    }

    if (commission.status.value === CommissionStatus.AVAILABLE.value) {
      commission.markAsReversed();
      await this.commissionRepository.save(commission);
      return;
    }

    if (commission.status.value === CommissionStatus.WITHDRAWN.value) {
      commission.markAsDebt();
      await this.commissionRepository.save(commission);
    }
  }
}
