import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class SetBillingConfigRequestDto {
  @IsIn(['kobana', 'tecnospeed', 'asaas'])
  provider!: 'kobana' | 'tecnospeed' | 'asaas';

  /** Em claro só no trânsito — cifrada antes de persistir; nunca devolvida. */
  @IsString()
  @MinLength(8)
  @MaxLength(4000)
  credentials!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimmed)
  agreementCode?: string | null;

  @IsUUID()
  settlementAccountId!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string | null;
}

export class EmitChargeRequestDto {
  @IsUUID()
  titleId!: string;

  @IsIn(['boleto', 'pix'])
  kind!: 'boleto' | 'pix';
}

export class DunningStepRequestDto {
  @IsInt()
  @Min(-60)
  @Max(365)
  offsetDays!: number;

  @IsIn(['whatsapp', 'email'])
  channel!: 'whatsapp' | 'email';

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  template!: string;

  @IsIn(['propose', 'auto'])
  mode!: 'propose' | 'auto';
}

export class SaveDunningRuleRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DunningStepRequestDto)
  steps!: DunningStepRequestDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(12)
  maxRebillings?: number | null;
}

export class RenegotiationInstallmentRequestDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999)
  amount!: number;

  @IsISO8601()
  dueDate!: string;
}

export class RenegotiateTitlesRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @IsUUID(undefined, { each: true })
  titleIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => RenegotiationInstallmentRequestDto)
  installments!: RenegotiationInstallmentRequestDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trimmed)
  description?: string | null;
}

export class ListChargesQueryDto {
  @IsOptional()
  @IsUUID()
  titleId?: string;

  @IsOptional()
  @IsIn(['registered', 'paid', 'cancelled', 'error'])
  status?: string;
}

export class ListDunningEventsQueryDto {
  @IsOptional()
  @IsIn(['proposed', 'sent', 'skipped'])
  status?: string;
}
