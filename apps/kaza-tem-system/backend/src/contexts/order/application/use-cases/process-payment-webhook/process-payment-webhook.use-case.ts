import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { CieloCheckoutService } from '@infrastructure/integrations/cielo/cielo-checkout.service';
import { ProcessPaymentWebhookCommand } from './process-payment-webhook.command';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../ports/output/order-repository.port';
import { OrderStatus } from '@contexts/order/domain/value-objects/order-status.vo';
import { OrderNotFoundException } from '@contexts/order/domain/exceptions/order-not-found.exception';

@Injectable()
export class ProcessPaymentWebhookUseCase implements UseCase<ProcessPaymentWebhookCommand, void> {
  private readonly successfulStatuses = new Set([1, 2, 20]);

  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly cieloCheckoutService: CieloCheckoutService,
  ) {}

  async execute(command: ProcessPaymentWebhookCommand): Promise<void> {
    const payment = await this.cieloCheckoutService.getPayment(command.paymentId);
    if (!payment.paymentId) {
      throw new OrderNotFoundException(`Pagamento ${command.paymentId} não encontrado na Cielo`);
    }

    const order = await this.orderRepository.findByPaymentId(payment.paymentId);
    if (!order) {
      return;
    }

    if (
      this.successfulStatuses.has(payment.status ?? -1) &&
      order.status.canTransitionTo(OrderStatus.PAID)
    ) {
      order.markAsPaid(payment.paymentId, 'cielo:webhook');
      await this.orderRepository.save(order);
    }
  }
}
