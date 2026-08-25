import { CommissionRule } from '../../domain/entities/commission-rule.entity';

export interface CommissionRuleInputDto {
  id?: string;
  minAmount: number;
  maxAmount?: number | null;
  percentage: number;
  isActive: boolean;
}

export class CommissionRuleDto {
  constructor(
    public readonly id: string,
    public readonly minAmount: number,
    public readonly maxAmount: number | null,
    public readonly percentage: number,
    public readonly isActive: boolean,
  ) {}

  static fromDomain(rule: CommissionRule): CommissionRuleDto {
    return new CommissionRuleDto(
      rule.id,
      rule.minAmount,
      rule.maxAmount,
      rule.percentage,
      rule.isActive,
    );
  }
}
