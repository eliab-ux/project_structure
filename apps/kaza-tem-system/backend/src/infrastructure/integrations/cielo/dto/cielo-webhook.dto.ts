import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CieloWebhookDto {
  @IsOptional()
  @IsString()
  PaymentId?: string;

  @IsOptional()
  @IsString()
  RecurrentPaymentId?: string;

  @IsOptional()
  @IsNumber()
  ChangeType?: number;

  @IsOptional()
  @IsNumber()
  Status?: number;

  @IsOptional()
  @IsNumber()
  Amount?: number;
}
