import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../ports/output/order-repository.port';
import { GetOrderQuery } from './get-order.query';
import { Order } from '../../../domain/entities/order.entity';
import { OrderId } from '../../../domain/value-objects/order-id.vo';
import { OrderNotFoundException } from '../../../domain/exceptions/order-not-found.exception';

@Injectable()
export class GetOrderUseCase implements UseCase<GetOrderQuery, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  async execute(query: GetOrderQuery): Promise<Order> {
    const order = await this.orderRepository.findById(OrderId.from(query.orderId));

    if (!order) {
      throw new OrderNotFoundException(`Pedido ${query.orderId} não encontrado`);
    }

    return order;
  }
}
