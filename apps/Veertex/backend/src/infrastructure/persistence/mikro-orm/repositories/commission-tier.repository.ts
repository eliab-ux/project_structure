import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { CommissionTierRepositoryPort } from '../../../../contexts/commission/application/ports/output/commission-tier-repository.port';
import { CommissionTier } from '../../../../contexts/commission/domain/model-a';
import { CommissionATierOrmEntity } from '../entities/commission-a-tier-orm.entity';

/**
 * Faixas do Modelo A. `getForAccount` lê as vigentes (o filtro de tenant + notDeleted + RLS escopam);
 * `replaceForAccount` faz soft-delete das antigas e insere as novas — config em bloco, sem DELETE.
 */
@Injectable()
export class MikroOrmCommissionTierRepository implements CommissionTierRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async getForAccount(): Promise<CommissionTier[]> {
    const rows = await this.em.find(
      CommissionATierOrmEntity,
      {},
      { orderBy: { thresholdPercent: 'ASC' } },
    );
    return rows.map((row) => ({
      thresholdPercent: Number(row.thresholdPercent),
      commissionPercent: Number(row.commissionPercent),
    }));
  }

  async replaceForAccount(accountId: string, tiers: CommissionTier[]): Promise<CommissionTier[]> {
    const now = new Date();
    const existing = await this.em.find(CommissionATierOrmEntity, {});
    for (const row of existing) {
      row.deletedAt = now;
    }
    for (const tier of tiers) {
      this.em.persist(
        this.em.create(CommissionATierOrmEntity, {
          id: randomUUID(),
          accountId,
          thresholdPercent: tier.thresholdPercent.toFixed(2),
          commissionPercent: tier.commissionPercent.toFixed(2),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }),
      );
    }
    await this.em.flush();
    return tiers;
  }
}
