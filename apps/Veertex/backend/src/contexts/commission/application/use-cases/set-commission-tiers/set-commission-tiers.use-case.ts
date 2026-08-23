import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  COMMISSION_TIER_REPOSITORY,
  CommissionTierRepositoryPort,
} from '../../ports/output/commission-tier-repository.port';
import { CommissionTier } from '../../../domain/model-a';
import { CommissionTierDto } from '../../dto/commission.dto';

export class SetCommissionTiersCommand {
  constructor(
    public readonly accountId: string,
    public readonly tiers: CommissionTier[],
  ) {}
}

/**
 * Define as faixas do Modelo A da conta (§2 do 02A) — SUBSTITUI o conjunto. Ordena por threshold e
 * remove duplicados de threshold (a última vence), para o motor não ver duas faixas no mesmo ponto.
 */
@Injectable()
export class SetCommissionTiersUseCase implements UseCase<
  SetCommissionTiersCommand,
  CommissionTierDto[]
> {
  constructor(
    @Inject(COMMISSION_TIER_REPOSITORY) private readonly tiers: CommissionTierRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: SetCommissionTiersCommand): Promise<CommissionTierDto[]> {
    const byThreshold = new Map<number, CommissionTier>();
    for (const tier of command.tiers) {
      byThreshold.set(Math.max(0, tier.thresholdPercent), {
        thresholdPercent: Math.max(0, tier.thresholdPercent),
        commissionPercent: Math.max(0, tier.commissionPercent),
      });
    }
    const normalized = [...byThreshold.values()].sort(
      (a, b) => a.thresholdPercent - b.thresholdPercent,
    );

    return this.uow.execute(async () => {
      const saved = await this.tiers.replaceForAccount(command.accountId, normalized);
      return saved.map(CommissionTierDto.fromDomain);
    });
  }
}
