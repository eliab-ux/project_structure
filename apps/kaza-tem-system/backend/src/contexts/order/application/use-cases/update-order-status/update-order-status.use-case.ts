import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { TrackingCode } from '../../../domain/value-objects/tracking-code.vo';
import { InvalidOrderStatusException } from '../../../domain/exceptions/invalid-order-status.exception';
import { OrderId } from '../../../domain/value-objects/order-id.vo';
import { OrderStatus } from '../../../domain/value-objects/order-status.vo';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../ports/output/order-repository.port';
import { OrderNotFoundException } from '../../../domain/exceptions/order-not-found.exception';
import { UpdateOrderStatusCommand } from './update-order-status.command';

@Injectable()
export class UpdateOrderStatusUseCase implements UseCase<UpdateOrderStatusCommand, void> {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  async execute(command: UpdateOrderStatusCommand): Promise<void> {
    const order = await this.orderRepository.findById(OrderId.from(command.orderId));

    if (!order) {
      throw new OrderNotFoundException(`Pedido ${command.orderId} não encontrado`);
    }

    const targetStatus = OrderStatus.from(command.status);

    if (!order.status.canTransitionTo(targetStatus)) {
      throw new InvalidOrderStatusException(
        `Não é possível alterar o status de ${order.status.value} para ${targetStatus.value}`,
      );
    }

    if (targetStatus === OrderStatus.PAID) {
      if (!command.paymentId || !command.paymentMethod) {
        throw new InvalidOrderStatusException(
          'Pagamento e método são obrigatórios para marcar como pago',
        );
      }
      order.markAsPaid(command.paymentId, command.paymentMethod);
    } else if (targetStatus === OrderStatus.SHIPPED) {
      if (!command.trackingCode) {
        throw new InvalidOrderStatusException(
          'Código de rastreio é obrigatório para marcar como enviado',
        );
      }
      order.markAsShipped(TrackingCode.from(command.trackingCode));
    } else {
      order.updateStatus(targetStatus);
    }

    await this.orderRepository.save(order);
  }
}
