import { Inject, Injectable } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { OrderRepositoryPort } from '../../../../contexts/order/application/ports/output/order-repository.port';
import { Order } from '../../../../contexts/order/domain/entities/order.entity';
import { OrderId } from '../../../../contexts/order/domain/value-objects/order-id.vo';
import { OrderMapper } from '../mappers/order.mapper';
import { OrderOrmEntity } from '../entities/order-orm.entity';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../ports/event-publisher.port';

@Injectable()
export class MikroOrmOrderRepository implements OrderRepositoryPort {
  constructor(
    @InjectRepository(OrderOrmEntity)
    private readonly repository: EntityRepository<OrderOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: OrderMapper,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: EventPublisherPort,
  ) {}

  async save(order: Order): Promise<Order> {
    const ormEntity = this.mapper.toOrm(order);
    await this.em.persistAndFlush(ormEntity);

    const events = order.pullDomainEvents();
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
    }

    return this.mapper.toDomain(ormEntity);
  }

  async findById(id: OrderId): Promise<Order | null> {
    const ormEntity = await this.repository.findOne({ id: id.value });
    return ormEntity ? this.mapper.toDomain(ormEntity) : null;
  }

  async findByPaymentId(paymentId: string): Promise<Order | null> {
    const ormEntity = await this.repository.findOne({ paymentId });
    return ormEntity ? this.mapper.toDomain(ormEntity) : null;
  }

  async findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Order[]> {
    const ormEntities = await this.repository.find(
      { userId },
      {
        limit: options?.limit,
        offset: options?.offset,
        orderBy: { createdAt: 'DESC' },
      },
    );
    return ormEntities.map((entity) => this.mapper.toDomain(entity));
  }

  async findByResellerId(
    resellerId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Order[]> {
    const ormEntities = await this.repository.find(
      { resellerId },
      {
        limit: options?.limit,
        offset: options?.offset,
        orderBy: { createdAt: 'DESC' },
      },
    );
    return ormEntities.map((entity) => this.mapper.toDomain(entity));
  }

  async countByResellerId(resellerId: string): Promise<number> {
    return this.repository.count({ resellerId });
  }

  async countByResellerIdSince(resellerId: string, since: Date): Promise<number> {
    return this.repository.count({ resellerId, createdAt: { $gte: since } });
  }

  async findAll(options?: {
    status?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Order[]> {
    const where: Record<string, unknown> = {};

    if (options?.status) {
      where.status = { $in: options.status };
    }

    const ormEntities = await this.repository.find(where, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: { createdAt: 'DESC' },
    });

    return ormEntities.map((entity) => this.mapper.toDomain(entity));
  }
}
