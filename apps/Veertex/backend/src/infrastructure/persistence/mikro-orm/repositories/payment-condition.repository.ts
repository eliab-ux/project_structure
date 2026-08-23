import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PaymentConditionRepositoryPort } from '../../../../contexts/payment-condition/application/ports/output/payment-condition-repository.port';
import { PaymentCondition } from '../../../../contexts/payment-condition/domain/entities/payment-condition.entity';
import { PaymentConditionKind } from '../../../../contexts/payment-condition/domain/payment-condition-kind';
import { PaymentConditionOrmEntity } from '../entities/payment-condition-orm.entity';

@Injectable()
export class MikroOrmPaymentConditionRepository implements PaymentConditionRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: PaymentConditionOrmEntity): PaymentCondition {
    return PaymentCondition.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      name: orm.name,
      kind: orm.kind as PaymentConditionKind,
      active: orm.active,
      createdAt: orm.createdAt,
    });
  }

  async findById(id: string): Promise<PaymentCondition | null> {
    const orm = await this.em.findOne(PaymentConditionOrmEntity, { id });
    return orm ? this.toDomain(orm) : null;
  }

  async list(includeInactive: boolean): Promise<PaymentCondition[]> {
    const rows = await this.em.find(
      PaymentConditionOrmEntity,
      { ...(includeInactive ? {} : { active: true }) },
      { orderBy: { name: 'ASC' } },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async save(condition: PaymentCondition): Promise<PaymentCondition> {
    const existing = await this.em.findOne(PaymentConditionOrmEntity, { id: condition.id });
    if (existing) {
      existing.name = condition.name;
      existing.kind = condition.kind;
      existing.active = condition.active;
      existing.updatedAt = new Date();
      await this.em.flush();
      return this.toDomain(existing);
    }
    const orm = this.em.create(PaymentConditionOrmEntity, {
      id: condition.id,
      accountId: condition.accountId,
      name: condition.name,
      kind: condition.kind,
      active: condition.active,
      createdAt: condition.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}
