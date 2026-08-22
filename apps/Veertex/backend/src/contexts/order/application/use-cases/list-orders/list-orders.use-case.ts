import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ListOrdersFilter,
  ORDER_REPOSITORY,
  OrderRepositoryPort,
} from '../../ports/output/order-repository.port';
import { OrderDto } from '../../dto/order.dto';

export class ListOrdersQuery {
  constructor(public readonly filter: ListOrdersFilter) {}
}

@Injectable()
export class ListOrdersUseCase implements UseCase<ListOrdersQuery, OrderDto[]> {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort) {}

  async execute(query: ListOrdersQuery): Promise<OrderDto[]> {
    const orders = await this.orders.list(query.filter);
    return orders.map(OrderDto.fromDomain);
  }
}
