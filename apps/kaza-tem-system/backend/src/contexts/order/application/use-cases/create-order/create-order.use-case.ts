import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../ports/output/order-repository.port';
import { CreateOrderCommand } from './create-order.command';
import { Order } from '../../../domain/entities/order.entity';
import { ShippingAddress } from '../../../domain/value-objects/shipping-address.vo';

@Injectable()
export class CreateOrderUseCase implements UseCase<CreateOrderCommand, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  async execute(command: CreateOrderCommand): Promise<Order> {
    const { payload } = command;

    const address = ShippingAddress.create({
      street: payload.shippingAddress.street,
      number: payload.shippingAddress.number,
      city: payload.shippingAddress.city,
      state: payload.shippingAddress.state,
      zipCode: payload.shippingAddress.zipCode,
      country: payload.shippingAddress.country,
      complement: payload.shippingAddress.complement,
    });

    const order = Order.create({
      userId: payload.userId,
      resellerId: payload.resellerId,
      items: payload.items,
      shippingAddress: address,
      shippingMethod: payload.shippingMethod,
      shippingCost: payload.shippingCost,
      discount: payload.discount,
      notes: payload.notes,
    });

    return this.orderRepository.save(order);
  }
}
