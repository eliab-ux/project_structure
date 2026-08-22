import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../ports/output/order-repository.port';
import { OrderId } from '../../../domain/value-objects/order-id.vo';
import { OrderDto } from '../../dto/order.dto';
import { OrderNotFoundException } from '../../../domain/exceptions/order-exceptions';

export class GetOrderQuery {
  constructor(public readonly orderId: string) {}
}

@Injectable()
export class GetOrderUseCase implements UseCase<GetOrderQuery, OrderDto> {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort) {}

  async execute(query: GetOrderQuery): Promise<OrderDto> {
    const order = await this.orders.findById(OrderId.from(query.orderId));
    if (!order) {
      throw new OrderNotFoundException(query.orderId);
    }
    return OrderDto.fromDomain(order);
  }
}
