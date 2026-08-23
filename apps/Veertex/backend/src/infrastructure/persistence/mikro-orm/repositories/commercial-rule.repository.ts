import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { CommercialRuleRepositoryPort } from '../../../../contexts/route/application/ports/output/commercial-rule-repository.port';
import { CommercialRule } from '../../../../contexts/route/domain/entities/commercial-rule.entity';
import { CommercialRuleOrmEntity } from '../entities/commercial-rule-orm.entity';

@Injectable()
export class MikroOrmCommercialRuleRepository implements CommercialRuleRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: CommercialRuleOrmEntity): CommercialRule {
    return CommercialRule.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      userId: orm.userId,
      allowedCompanyIds: orm.allowedCompanyIds ?? [],
      allowedPaymentConditionIds: orm.allowedPaymentConditionIds ?? [],
      allowedPriceListIds: orm.allowedPriceListIds ?? [],
      allowedOperationNatures: orm.allowedOperationNatures ?? [],
      createdAt: orm.createdAt,
    });
  }

  async findByUser(userId: string): Promise<CommercialRule | null> {
    const orm = await this.em.findOne(CommercialRuleOrmEntity, { userId });
    return orm ? this.toDomain(orm) : null;
  }

  async save(rule: CommercialRule): Promise<CommercialRule> {
    const existing = await this.em.findOne(CommercialRuleOrmEntity, { id: rule.id });
    if (existing) {
      existing.allowedCompanyIds = [...rule.allowedCompanyIds];
      existing.allowedPaymentConditionIds = [...rule.allowedPaymentConditionIds];
      existing.allowedPriceListIds = [...rule.allowedPriceListIds];
      existing.allowedOperationNatures = [...rule.allowedOperationNatures];
      existing.updatedAt = new Date();
      await this.em.flush();
      return this.toDomain(existing);
    }
    const orm = this.em.create(CommercialRuleOrmEntity, {
      id: rule.id,
      accountId: rule.accountId,
      userId: rule.userId,
      allowedCompanyIds: [...rule.allowedCompanyIds],
      allowedPaymentConditionIds: [...rule.allowedPaymentConditionIds],
      allowedPriceListIds: [...rule.allowedPriceListIds],
      allowedOperationNatures: [...rule.allowedOperationNatures],
      createdAt: rule.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}
