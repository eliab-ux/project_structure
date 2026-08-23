import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { SalesTargetRepositoryPort } from '../../../../contexts/commission/application/ports/output/sales-target-repository.port';
import { SalesTarget } from '../../../../contexts/commission/domain/entities/sales-target.entity';
import { SalesTargetOrmEntity } from '../entities/sales-target-orm.entity';

@Injectable()
export class MikroOrmSalesTargetRepository implements SalesTargetRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: SalesTargetOrmEntity): SalesTarget {
    return SalesTarget.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      userId: orm.userId,
      period: orm.period,
      targetValue: Number(orm.targetValue),
      createdAt: orm.createdAt,
    });
  }

  async findByUserPeriod(userId: string, period: string): Promise<SalesTarget | null> {
    const orm = await this.em.findOne(SalesTargetOrmEntity, { userId, period });
    return orm ? this.toDomain(orm) : null;
  }

  async listByPeriod(period: string): Promise<SalesTarget[]> {
    const rows = await this.em.find(
      SalesTargetOrmEntity,
      { period },
      { orderBy: { userId: 'ASC' } },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async save(target: SalesTarget): Promise<SalesTarget> {
    const existing = await this.em.findOne(SalesTargetOrmEntity, { id: target.id });
    if (existing) {
      existing.targetValue = target.targetValue.toFixed(2);
      existing.updatedAt = new Date();
      await this.em.flush();
      return this.toDomain(existing);
    }
    const orm = this.em.create(SalesTargetOrmEntity, {
      id: target.id,
      accountId: target.accountId,
      userId: target.userId,
      period: target.period,
      targetValue: target.targetValue.toFixed(2),
      createdAt: target.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}
