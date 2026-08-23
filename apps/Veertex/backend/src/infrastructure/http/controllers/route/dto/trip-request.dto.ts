import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TRIP_STATUSES } from '../../../../../contexts/route/domain/entities/trip.entity';
import { FIELD_RECEIPT_METHODS } from '../../../../../contexts/route/domain/entities/field-receipt.entity';
import { TRIP_EXPENSE_CATEGORIES } from '../../../../../contexts/route/domain/entities/trip-expense.entity';

export class CreateTripRequestDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  routeId!: string;

  @IsUUID()
  salesRepId!: string;

  @IsOptional()
  @IsUUID()
  helperUserId?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999)
  initialCash?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(9_999_999)
  initialKm?: number;
}

export class ArriveTripRequestDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999)
  returnCash?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(9_999_999)
  finalKm?: number;
}

export class ListTripsQueryDto {
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @IsUUID()
  salesRepId?: string;

  @IsOptional()
  @IsIn(TRIP_STATUSES as unknown as string[])
  status?: string;
}

export class CargoLineRequestDto {
  @IsUUID()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9_999_999)
  quantity!: number;
}

export class LoadTripCargoRequestDto {
  /** Depósito (warehouse) de onde a carga sai. */
  @IsUUID()
  fromLocationId!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um item.' })
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CargoLineRequestDto)
  lines!: CargoLineRequestDto[];
}

export class RegisterFieldReceiptRequestDto {
  /** Título cobrado (da carteira). Ausente = "outros recebimentos" (à vista, fora da carteira). */
  @IsOptional()
  @IsUUID()
  titleId?: string | null;

  @IsIn(FIELD_RECEIPT_METHODS as unknown as string[])
  method!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999)
  amount!: number;

  /** Juros de atraso cobrados em campo (§3.2 do 04) — recebimento classificado. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999)
  interest?: number;
}

export class EffectuateFieldReceiptRequestDto {
  /** Conta financeira que recebe (caixa da viagem, banco...) — a retaguarda escolhe. */
  @IsUUID()
  financialAccountId!: string;
}

export class ReturnConsignedItemsRequestDto {
  /** Depósito (warehouse) que recebe a devolução. */
  @IsUUID()
  toLocationId!: string;

  @IsOptional()
  @IsUUID()
  orderId?: string | null;

  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um item.' })
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CargoLineRequestDto)
  lines!: CargoLineRequestDto[];
}

export class ExchangeConsignedItemsRequestDto {
  @IsOptional()
  @IsUUID()
  orderId?: string | null;

  @IsUUID()
  returnedProductId!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9_999_999)
  returnedQuantity!: number;

  @IsUUID()
  takenProductId!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9_999_999)
  takenQuantity!: number;
}

export class RegisterTripExpenseRequestDto {
  @IsIn(TRIP_EXPENSE_CATEGORIES as unknown as string[])
  category!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;

  @IsOptional()
  @IsISO8601()
  spentAt?: string;
}

export class CloseTripRequestDto {
  /** Gerente comissionado (Y% sobre o recebido da carteira) — opcional, informado no fechamento. */
  @IsOptional()
  @IsUUID()
  managerUserId?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  managerPercent?: number;

  /** Ajudante: valor FIXO da(s) semana(s) — não é % (§2 do 04). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999)
  helperAmount?: number;
}
