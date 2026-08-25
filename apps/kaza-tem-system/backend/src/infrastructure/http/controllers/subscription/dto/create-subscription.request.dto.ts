import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

class CardDto {
  @IsString()
  number!: string;

  @IsString()
  holder!: string;

  @IsString()
  expirationDate!: string;

  @IsString()
  securityCode!: string;

  @IsString()
  brand!: string;
}

class CustomerDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  document!: string;
}

export class CreateSubscriptionRequestDto {
  @IsString()
  resellerId!: string;

  @IsNotEmpty()
  card!: CardDto;

  @IsNotEmpty()
  customer!: CustomerDto;

  @IsOptional()
  @IsNumber()
  amount?: number;
}
