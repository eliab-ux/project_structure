import { Transform, Type } from 'class-transformer';
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
  ValidateNested,
} from 'class-validator';
import { DELIVERY_MODES, ORDER_ORIGINS } from '../../../../../contexts/order/domain/order-origin';
import { ORDER_STATUSES } from '../../../../../contexts/order/domain/order-status';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class OrderItemRequestDto {
  @IsUUID()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9_999_999)
  quantity!: number;

  /** Ausente → usa o preço base do produto. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999)
  unitPrice?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999)
  discountValue?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trimmed)
  description?: string | null;
}

export class CreateOrderRequestDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  contactId!: string;

  @IsOptional()
  @IsUUID()
  salesRepId?: string | null;

  @IsIn(ORDER_ORIGINS as unknown as string[])
  origin!: string;

  @IsOptional()
  @IsIn(DELIVERY_MODES as unknown as string[])
  deliveryMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimmed)
  originDetail?: string | null;

  /** Viagem da consignação (§3.1 do 04) — obrigatória quando origin='rota' (validado no use case). */
  @IsOptional()
  @IsUUID()
  tripId?: string | null;

  /** Condição de pagamento (§3.6 do 02). Ausente → herda o default do contato. */
  @IsOptional()
  @IsUUID()
  paymentConditionId?: string | null;

  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um item.' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => OrderItemRequestDto)
  items!: OrderItemRequestDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999)
  discountValue?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trimmed)
  notes?: string | null;

  @IsOptional()
  @IsISO8601()
  referenceDate?: string;

  /** Validade do orçamento (§3.3 do 02A) — opcional, só usada quando vira `orcamento`. */
  @IsOptional()
  @IsISO8601()
  validUntil?: string;
}

export class UpdateOrderRequestDto {
  @IsOptional()
  @IsIn(ORDER_ORIGINS as unknown as string[])
  origin?: string;

  @IsOptional()
  @IsUUID()
  paymentConditionId?: string | null;

  @IsOptional()
  @IsIn(DELIVERY_MODES as unknown as string[])
  deliveryMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimmed)
  originDetail?: string | null;

  @IsOptional()
  @IsUUID()
  salesRepId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => OrderItemRequestDto)
  items?: OrderItemRequestDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999)
  discountValue?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trimmed)
  notes?: string | null;

  @IsOptional()
  @IsISO8601()
  referenceDate?: string;

  @IsOptional()
  @IsISO8601()
  validUntil?: string;
}

export class ListOrdersQueryDto {
  @IsOptional()
  @IsIn(ORDER_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsUUID()
  salesRepId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimmed)
  search?: string;

  @IsOptional()
  @IsInt()
  page?: number;
}

export class SoldLineRequestDto {
  @IsUUID()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9_999_999)
  quantity!: number;
}

export class CloseConsignmentRequestDto {
  /**
   * Linhas efetivamente VENDIDAS. Ausente = itens do pedido inteiros. A retaguarda que registrou
   * devolução/troca informa o vendido real (baixar o total após devolução baixaria duas vezes).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SoldLineRequestDto)
  soldLines?: SoldLineRequestDto[] | null;
}
