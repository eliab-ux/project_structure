import { SalesTarget } from '../../domain/entities/sales-target.entity';
import { CommissionTier, ModelAResult } from '../../domain/model-a';

export class CommissionTierDto {
  thresholdPercent!: number;
  commissionPercent!: number;

  static fromDomain(tier: CommissionTier): CommissionTierDto {
    const dto = new CommissionTierDto();
    dto.thresholdPercent = tier.thresholdPercent;
    dto.commissionPercent = tier.commissionPercent;
    return dto;
  }
}

export class SalesTargetDto {
  id!: string;
  userId!: string;
  period!: string;
  targetValue!: number;

  static fromDomain(target: SalesTarget): SalesTargetDto {
    const dto = new SalesTargetDto();
    dto.id = target.id;
    dto.userId = target.userId;
    dto.period = target.period;
    dto.targetValue = target.targetValue;
    return dto;
  }
}

export class CommissionModelAResultDto {
  salesRepId!: string;
  period!: string;
  meta!: number;
  vendido!: number;
  ratioPercent!: number;
  appliedThresholdPercent!: number | null;
  commissionPercent!: number;
  commissionValue!: number;
  /** Id do título a pagar gerado quando a comissão é MATERIALIZADA (POST). `null` na apuração (GET). */
  payableTitleId!: string | null;

  static build(
    salesRepId: string,
    period: string,
    result: ModelAResult,
    payableTitleId: string | null = null,
  ): CommissionModelAResultDto {
    const dto = new CommissionModelAResultDto();
    dto.salesRepId = salesRepId;
    dto.period = period;
    dto.meta = result.meta;
    dto.vendido = result.vendido;
    dto.ratioPercent = result.ratioPercent;
    dto.appliedThresholdPercent = result.appliedThresholdPercent;
    dto.commissionPercent = result.commissionPercent;
    dto.commissionValue = result.commissionValue;
    dto.payableTitleId = payableTitleId;
    return dto;
  }
}
