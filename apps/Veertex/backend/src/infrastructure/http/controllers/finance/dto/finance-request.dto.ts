import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FINANCIAL_ACCOUNT_TYPES } from '../../../../../contexts/finance/domain/financial-account-type';
import {
  CATEGORY_KINDS,
  CATEGORY_OPERATIONS,
} from '../../../../../contexts/finance/domain/category-kind';
import { TITLE_STATUSES } from '../../../../../contexts/finance/domain/title-enums';
import { SETTLEMENT_METHODS } from '../../../../../contexts/finance/domain/entities/title-settlement.entity';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateFinancialAccountRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trimmed)
  name!: string;

  @IsIn(FINANCIAL_ACCOUNT_TYPES as unknown as string[])
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimmed)
  institution?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-999_999_999)
  @Max(999_999_999)
  initialBalance?: number;
}

export class UpdateFinancialAccountRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trimmed)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimmed)
  institution?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateFinancialCategoryRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trimmed)
  name!: string;

  @IsIn(CATEGORY_KINDS as unknown as string[])
  kind!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimmed)
  dreLine?: string | null;

  @IsOptional()
  @IsIn(CATEGORY_OPERATIONS as unknown as string[])
  defaultOperation?: string | null;
}

export class UpdateFinancialCategoryRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trimmed)
  name?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimmed)
  dreLine?: string | null;

  @IsOptional()
  @IsIn(CATEGORY_OPERATIONS as unknown as string[])
  defaultOperation?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ListFinanceQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  includeInactive?: boolean;
}

export class CreateTitleRequestDto {
  @IsUUID()
  companyId!: string;

  @IsOptional()
  @IsUUID()
  contactId?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trimmed)
  description!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999_999)
  amount!: number;

  @IsOptional()
  @IsISO8601()
  issueDate?: string;

  @IsISO8601()
  dueDate!: string;
}

export class SettleTitleRequestDto {
  @IsUUID()
  financialAccountId!: string;

  @IsIn(SETTLEMENT_METHODS as unknown as string[])
  method!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999_999)
  principal!: number;

  @IsOptional()
  @IsISO8601()
  settledAt?: string;

  // Overrides opcionais — ausentes, o FIN calcula juros/multa pelos parâmetros da conta.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999)
  interest?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999)
  fine?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999)
  discount?: number;
}

export class ListTitlesQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsIn(TITLE_STATUSES as unknown as string[])
  status?: string;
}
