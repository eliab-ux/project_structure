import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { STOCK_MOVEMENT_TYPES } from '../../../../../contexts/stock/domain/movement-type';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterMovementRequestDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  productId!: string;

  @IsIn(STOCK_MOVEMENT_TYPES as unknown as string[])
  type!: string;

  /** Magnitude (>0) para entrada/saída; COM SINAL para ajuste de inventário. */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(-9_999_999)
  @Max(9_999_999)
  quantity!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(9_999_999)
  unitCost?: number | null;

  @IsOptional()
  @IsUUID()
  relatedMovementId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimmed)
  note?: string | null;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}

export class StockBalanceQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  productId!: string;
}

export class ListMovementsQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsIn(STOCK_MOVEMENT_TYPES as unknown as string[])
  type?: string;
}
