import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class UpdateResellerBankInfoRequestDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  bankName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  bankCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  bankAgency?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  bankAccount?: string;

  @IsOptional()
  @IsIn(['checking', 'savings'])
  bankAccountType?: 'checking' | 'savings';

  @IsOptional()
  @IsString()
  @Length(2, 255)
  bankHolderName?: string;

  @IsOptional()
  @IsString()
  @Length(11, 14)
  bankHolderCpf?: string;

  @IsOptional()
  @IsString()
  pixKey?: string;

  @IsOptional()
  @IsIn(['cpf', 'email', 'phone', 'random'])
  pixKeyType?: 'cpf' | 'email' | 'phone' | 'random';
}
