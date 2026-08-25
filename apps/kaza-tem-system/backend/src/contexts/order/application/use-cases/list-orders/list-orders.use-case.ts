import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../ports/output/order-repository.port';
import { ListOrdersQuery } from './list-orders.query';
import { Order } from '../../../domain/entities/order.entity';

@Injectable()
export class ListOrdersUseCase implements UseCase<ListOrdersQuery, Order[]> {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  async execute(query: ListOrdersQuery): Promise<Order[]> {
    const statuses = query.status
      ? query.status
          .split(',')
          .map((status) => status.trim())
          .filter((status) => status.length > 0)
      : undefined;

    return this.orderRepository.findAll({
      status: statuses,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
