import { IsArray, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreateOrderItemRequestDto {
  @IsString()
  productId!: string;

  @IsString()
  sku!: string;

  @IsString()
  name!: string;

  @IsPositive()
  quantity!: number;

  @IsPositive()
  unitPrice!: number;
}

class ShippingAddressRequestDto {
  @IsString()
  street!: string;

  @IsString()
  number!: string;

  @IsString()
  city!: string;

  @IsString()
  state!: string;

  @IsString()
  zipCode!: string;

  @IsString()
  country!: string;

  @IsOptional()
  @IsString()
  complement?: string;
}

export class CreateOrderRequestDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  resellerId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemRequestDto)
  items!: CreateOrderItemRequestDto[];

  @ValidateNested()
  @Type(() => ShippingAddressRequestDto)
  shippingAddress!: ShippingAddressRequestDto;

  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @IsOptional()
  @IsPositive()
  shippingCost?: number;

  @IsOptional()
  discount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
