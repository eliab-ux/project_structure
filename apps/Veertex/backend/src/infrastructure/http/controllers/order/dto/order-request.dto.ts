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
import { ORDER_ORIGINS } from '../../../../../contexts/order/domain/order-origin';

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
}

export class UpdateOrderRequestDto {
  @IsOptional()
  @IsIn(ORDER_ORIGINS as unknown as string[])
  origin?: string;

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
}

export class ListOrdersQueryDto {
  @IsOptional()
  @IsIn(['rascunho', 'confirmado', 'faturado', 'concluido', 'cancelado'])
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
