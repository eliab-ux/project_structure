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
import {
  REGISTERABLE_MOVEMENT_TYPES,
  STOCK_MOVEMENT_TYPES,
} from '../../../../../contexts/stock/domain/movement-type';
import { CREATABLE_LOCATION_KINDS } from '../../../../../contexts/stock/domain/entities/stock-location.entity';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterMovementRequestDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  productId!: string;

  @IsUUID()
  locationId!: string;

  // Só os tipos que o registro manual cria; transferência entra por /stock/transfers (§3.1 do 03A).
  @IsIn(REGISTERABLE_MOVEMENT_TYPES as unknown as string[])
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

  /** Recorte por localização (§2 do 03A). Ausente = saldo consolidado da empresa. */
  @IsOptional()
  @IsUUID()
  locationId?: string;
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

export class TransferStockRequestDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  productId!: string;

  @IsUUID()
  fromLocationId!: string;

  @IsUUID()
  toLocationId!: string;

  // Sempre positiva: transferência é magnitude; a direção é dada pelo par de movimentos.
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9_999_999)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimmed)
  note?: string | null;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}

export class ListStockLocationsQueryDto {
  @IsUUID()
  companyId!: string;
}

export class CreateStockLocationRequestDto {
  @IsUUID()
  companyId!: string;

  @IsIn(CREATABLE_LOCATION_KINDS as unknown as string[])
  kind!: string;

  @IsString()
  @MaxLength(120)
  @Transform(trimmed)
  name!: string;
}
