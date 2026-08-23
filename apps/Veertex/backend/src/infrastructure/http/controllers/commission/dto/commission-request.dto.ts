import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export class CommissionTierRequestDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  thresholdPercent!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPercent!: number;
}

export class SetCommissionTiersRequestDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CommissionTierRequestDto)
  tiers!: CommissionTierRequestDto[];
}

export class SetSalesTargetRequestDto {
  @IsUUID()
  userId!: string;

  @Matches(PERIOD, { message: 'Período deve ser YYYY-MM.' })
  period!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999)
  targetValue!: number;
}

export class PeriodQueryDto {
  @Matches(PERIOD, { message: 'Período deve ser YYYY-MM.' })
  period!: string;
}

export class ComputeCommissionQueryDto {
  @IsUUID()
  salesRepId!: string;

  @Matches(PERIOD, { message: 'Período deve ser YYYY-MM.' })
  period!: string;
}

export class GenerateCommissionPayableRequestDto {
  @IsUUID()
  salesRepId!: string;

  @Matches(PERIOD, { message: 'Período deve ser YYYY-MM.' })
  period!: string;

  /** Empresa que PAGA a comissão — o operador escolhe (o título pertence a uma empresa, §2.6). */
  @IsUUID()
  companyId!: string;
}
