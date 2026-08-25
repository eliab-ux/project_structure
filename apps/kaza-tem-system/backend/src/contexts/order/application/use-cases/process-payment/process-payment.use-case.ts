import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { CieloCheckoutService } from '@infrastructure/integrations/cielo/cielo-checkout.service';
import { CieloPaymentResponse } from '@infrastructure/integrations/cielo/cielo-client.port';
import { ProcessPaymentCommand } from './process-payment.command';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../ports/output/order-repository.port';
import { OrderId } from '@contexts/order/domain/value-objects/order-id.vo';
import { OrderStatus } from '@contexts/order/domain/value-objects/order-status.vo';
import { OrderNotFoundException } from '@contexts/order/domain/exceptions/order-not-found.exception';
import { InvalidOrderStatusException } from '@contexts/order/domain/exceptions/invalid-order-status.exception';

@Injectable()
export class ProcessPaymentUseCase implements UseCase<ProcessPaymentCommand, CieloPaymentResponse> {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly cieloCheckoutService: CieloCheckoutService,
  ) {}

  private readonly successfulStatuses = new Set([1, 2, 20]);

  async execute(command: ProcessPaymentCommand): Promise<CieloPaymentResponse> {
    const order = await this.orderRepository.findById(OrderId.from(command.orderId));
    if (!order) {
      throw new OrderNotFoundException(`Pedido ${command.orderId} não encontrado`);
    }

    if (!order.status.canTransitionTo(OrderStatus.PAID)) {
      throw new InvalidOrderStatusException('Pedido não pode ser pago no status atual');
    }

    const request = {
      orderId: order.id.value,
      amount: command.amount ?? Math.round(order.total * 100),
      installments: command.installments,
      card: command.card,
      customer: command.customer,
    };

    const response = await this.cieloCheckoutService.processPayment(request);

    if (!response.paymentId) {
      throw new Error('Resposta inválida da Cielo, nenhum paymentId retornado');
    }

    if (
      this.successfulStatuses.has(response.status ?? -1) &&
      order.status.canTransitionTo(OrderStatus.PAID)
    ) {
      order.markAsPaid(response.paymentId, `cielo:${command.card.brand}`);
      await this.orderRepository.save(order);
    }

    return response;
  }
}
