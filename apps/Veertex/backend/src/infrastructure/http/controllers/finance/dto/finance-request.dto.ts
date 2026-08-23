import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
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
