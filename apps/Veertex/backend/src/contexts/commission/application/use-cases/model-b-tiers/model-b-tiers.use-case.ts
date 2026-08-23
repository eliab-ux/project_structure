import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  COMMISSION_B_TIER_REPOSITORY,
  CommissionBTierRepositoryPort,
  DEFAULT_MODEL_B_TIERS,
} from '../../ports/output/commission-b-tier-repository.port';
import { CommissionTier } from '../../../domain/model-a';
import { InvalidCommissionTiersException } from '../../../domain/exceptions/commission-exceptions';

export interface ModelBTiersDto {
  tiers: CommissionTier[];
  /** `true` = a conta ainda usa as faixas reais da operação (seed) — nada customizado. */
  usingDefault: boolean;
}

/**
 * Faixas do Modelo B, "totalmente customizáveis por conta" (requisito do levantamento, 02A §2.2 —
 * ratificado em 23/08/2026). O DEFAULT real da operação (50→6%, 70→7%, 90→8%) fica como SEED:
 * conta sem customização usa e a tela mostra que está no padrão.
 */
@Injectable()
export class GetModelBTiersUseCase implements UseCase<void, ModelBTiersDto> {
  constructor(
    @Inject(COMMISSION_B_TIER_REPOSITORY)
    private readonly tiers: CommissionBTierRepositoryPort,
  ) {}

  async execute(): Promise<ModelBTiersDto> {
    const custom = await this.tiers.getForAccount();
    if (custom.length > 0) {
      return { tiers: custom, usingDefault: false };
    }
    return { tiers: [...DEFAULT_MODEL_B_TIERS], usingDefault: true };
  }
}

export class SetModelBTiersCommand {
  constructor(
    public readonly accountId: string,
    public readonly tiers: CommissionTier[],
  ) {}
}

@Injectable()
export class SetModelBTiersUseCase implements UseCase<SetModelBTiersCommand, ModelBTiersDto> {
  constructor(
    @Inject(COMMISSION_B_TIER_REPOSITORY)
    private readonly tiers: CommissionBTierRepositoryPort,
  ) {}

  async execute(command: SetModelBTiersCommand): Promise<ModelBTiersDto> {
    // As mesmas invariantes das faixas do A: ao menos uma, limiares únicos e crescentes junto com
    // a comissão — faixa maior pagando menos é erro de digitação em 100% dos casos.
    if (command.tiers.length === 0) {
      throw new InvalidCommissionTiersException('Informe ao menos uma faixa.');
    }
    const sorted = [...command.tiers].sort((a, b) => a.thresholdPercent - b.thresholdPercent);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].thresholdPercent === sorted[i - 1].thresholdPercent) {
        throw new InvalidCommissionTiersException('Limiares de faixa não podem se repetir.');
      }
      if (sorted[i].commissionPercent < sorted[i - 1].commissionPercent) {
        throw new InvalidCommissionTiersException(
          'Uma faixa mais alta não pode comissionar menos que a anterior.',
        );
      }
    }
    const saved = await this.tiers.replaceForAccount(command.accountId, sorted);
    return { tiers: saved, usingDefault: false };
  }
}
