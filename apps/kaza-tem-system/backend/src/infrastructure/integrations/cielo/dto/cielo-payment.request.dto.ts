import { IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const CIELO_BRANDS = ['Visa', 'Master', 'Elo', 'Amex', 'Hipercard'] as const;

class CieloCardRequestDto {
  @IsString()
  number!: string;

  @IsString()
  holder!: string;

  @IsString()
  expirationDate!: string;

  @IsString()
  securityCode!: string;

  @IsString()
  @IsIn(CIELO_BRANDS)
  brand!: (typeof CIELO_BRANDS)[number];
}

class CieloCustomerRequestDto {
  @IsString()
  name!: string;

  @IsString()
  email!: string;

  @IsString()
  document!: string;
}

export class CieloPaymentRequestDto {
  @IsNumber()
  installments!: number;

  @ValidateNested()
  @Type(() => CieloCardRequestDto)
  card!: CieloCardRequestDto;

  @ValidateNested()
  @Type(() => CieloCustomerRequestDto)
  customer!: CieloCustomerRequestDto;

  @IsOptional()
  @IsNumber()
  amount?: number;
}
