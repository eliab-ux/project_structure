import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../ports/output/order-repository.port';
import { Order } from '../../../domain/entities/order.entity';

export class ListUserOrdersQuery {
  constructor(
    public readonly userId: string,
    public readonly limit?: number,
    public readonly offset?: number,
  ) {}
}

@Injectable()
export class ListUserOrdersUseCase implements UseCase<ListUserOrdersQuery, Order[]> {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  async execute(query: ListUserOrdersQuery): Promise<Order[]> {
    return this.orderRepository.findByUserId(query.userId, {
      limit: query.limit,
      offset: query.offset,
    });
  }
}
