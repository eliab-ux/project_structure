import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { CommissionBTierRepositoryPort } from '../../../../contexts/commission/application/ports/output/commission-b-tier-repository.port';
import { CommissionTier } from '../../../../contexts/commission/domain/model-a';
import { CommissionBTierOrmEntity } from '../entities/commission-b-tier-orm.entity';

/** Faixas do Modelo B — mesma mecânica das do A: troca em bloco por soft-delete + insert. */
@Injectable()
export class MikroOrmCommissionBTierRepository implements CommissionBTierRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async getForAccount(): Promise<CommissionTier[]> {
    const rows = await this.em.find(
      CommissionBTierOrmEntity,
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
    const existing = await this.em.find(CommissionBTierOrmEntity, {});
    for (const row of existing) {
      row.deletedAt = now;
    }
    for (const tier of tiers) {
      this.em.persist(
        this.em.create(CommissionBTierOrmEntity, {
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
