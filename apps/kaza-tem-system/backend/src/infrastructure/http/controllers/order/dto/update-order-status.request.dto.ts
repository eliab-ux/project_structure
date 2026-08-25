import { IsIn, IsOptional, IsString } from 'class-validator';

const STATUS_VALUES = [
  'pending',
  'awaiting_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'canceled',
] as const;

export class UpdateOrderStatusRequestDto {
  @IsString()
  @IsIn(STATUS_VALUES)
  status!: string;

  @IsOptional()
  @IsString()
  trackingCode?: string;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
