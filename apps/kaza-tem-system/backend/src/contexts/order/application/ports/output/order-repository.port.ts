import { Order } from '../../../domain/entities/order.entity';
import { OrderId } from '../../../domain/value-objects/order-id.vo';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface OrderRepositoryPort {
  save(order: Order): Promise<Order>;
  findById(id: OrderId): Promise<Order | null>;
  findByPaymentId(paymentId: string): Promise<Order | null>;
  findByUserId(userId: string, options?: { limit?: number; offset?: number }): Promise<Order[]>;
  findByResellerId(
    resellerId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Order[]>;
  countByResellerId(resellerId: string): Promise<number>;
  countByResellerIdSince(resellerId: string, since: Date): Promise<number>;
  findAll(options?: { status?: string[]; limit?: number; offset?: number }): Promise<Order[]>;
}
