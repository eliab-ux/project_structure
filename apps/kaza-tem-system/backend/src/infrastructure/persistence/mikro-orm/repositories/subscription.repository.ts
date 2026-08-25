import { Injectable } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Subscription } from '../../../../contexts/subscription/domain/entities/subscription.entity';
import { SubscriptionRepositoryPort } from '../../../../contexts/subscription/application/ports/output/subscription-repository.port';
import { SubscriptionMapper } from '../mappers/subscription.mapper';
import { SubscriptionOrmEntity } from '../entities/subscription-orm.entity';

@Injectable()
export class MikroOrmSubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(
    @InjectRepository(SubscriptionOrmEntity)
    private readonly repository: EntityRepository<SubscriptionOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: SubscriptionMapper,
  ) {}

  async save(subscription: Subscription): Promise<Subscription> {
    const existing = await this.repository.findOne({ id: subscription.id.value });
    const orm = existing ?? new SubscriptionOrmEntity();

    orm.id = subscription.id.value;
    orm.resellerId = subscription.resellerId;
    orm.cieloRecurrenceId = subscription.cieloRecurrenceId;
    orm.status = subscription.status.value;
    orm.amount = subscription.amount;
    orm.nextBillingDate = subscription.nextBillingDate;
    orm.startedAt = subscription.startedAt;
    orm.canceledAt = subscription.canceledAt ?? undefined;
    orm.createdAt = existing ? existing.createdAt : subscription.startedAt;
    orm.updatedAt = subscription.updatedAt;

    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async findByResellerId(resellerId: string): Promise<Subscription | null> {
    const orm = await this.repository.findOne({ resellerId });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByRecurrenceId(recurrenceId: string): Promise<Subscription | null> {
    const orm = await this.repository.findOne({ cieloRecurrenceId: recurrenceId });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findById(id: string): Promise<Subscription | null> {
    const orm = await this.repository.findOne({ id });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findSuspendedBefore(date: Date): Promise<Subscription[]> {
    const list = await this.repository.find(
      { status: 'suspended', updatedAt: { $lte: date } },
      {
        orderBy: { updatedAt: 'ASC' },
      },
    );
    return list.map((entity) => this.mapper.toDomain(entity));
  }

  async findAll(options?: {
    status?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Subscription[]> {
    const where: Record<string, unknown> = {};
    if (options?.status) {
      where.status = { $in: options.status };
    }

    const list = await this.repository.find(where, {
      orderBy: { createdAt: 'DESC' },
      limit: options?.limit,
      offset: options?.offset,
    });
    return list.map((entity) => this.mapper.toDomain(entity));
  }

  async delete(subscription: Subscription): Promise<void> {
    await this.em.nativeDelete(SubscriptionOrmEntity, { id: subscription.id.value });
  }
}
