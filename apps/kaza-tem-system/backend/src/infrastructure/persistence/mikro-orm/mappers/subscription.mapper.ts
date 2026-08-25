import { Injectable } from '@nestjs/common';
import { Subscription } from '../../../../contexts/subscription/domain/entities/subscription.entity';
import { SubscriptionOrmEntity } from '../entities/subscription-orm.entity';
import { SubscriptionStatus } from '../../../../contexts/subscription/domain/value-objects/subscription-status.vo';
import { SubscriptionId } from '../../../../contexts/subscription/domain/value-objects/subscription-id.vo';

@Injectable()
export class SubscriptionMapper {
  toDomain(orm: SubscriptionOrmEntity): Subscription {
    return Subscription.reconstitute({
      id: SubscriptionId.from(orm.id),
      resellerId: orm.resellerId,
      cieloRecurrenceId: orm.cieloRecurrenceId,
      status: SubscriptionStatus.from(orm.status),
      amount: Number(orm.amount),
      nextBillingDate: orm.nextBillingDate ?? new Date(),
      startedAt: orm.startedAt,
      canceledAt: orm.canceledAt ?? null,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(domain: Subscription): SubscriptionOrmEntity {
    const entity = new SubscriptionOrmEntity();
    entity.id = domain.id.value;
    entity.resellerId = domain.resellerId;
    entity.cieloRecurrenceId = domain.cieloRecurrenceId;
    entity.status = domain.status.value;
    entity.amount = domain.amount;
    entity.nextBillingDate = domain.nextBillingDate;
    entity.startedAt = domain.startedAt;
    entity.canceledAt = domain.canceledAt ?? undefined;
    entity.createdAt = domain.startedAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
}
