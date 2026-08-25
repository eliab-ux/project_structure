import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../ports/output/order-repository.port';
import { CancelOrderCommand } from './cancel-order.command';
import { OrderId } from '../../../domain/value-objects/order-id.vo';
import { OrderNotFoundException } from '../../../domain/exceptions/order-not-found.exception';

@Injectable()
export class CancelOrderUseCase implements UseCase<CancelOrderCommand, void> {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  async execute(command: CancelOrderCommand): Promise<void> {
    const order = await this.orderRepository.findById(OrderId.from(command.orderId));

    if (!order) {
      throw new OrderNotFoundException(`Pedido ${command.orderId} não encontrado`);
    }

    order.cancel(command.reason);
    await this.orderRepository.save(order);
  }
}
