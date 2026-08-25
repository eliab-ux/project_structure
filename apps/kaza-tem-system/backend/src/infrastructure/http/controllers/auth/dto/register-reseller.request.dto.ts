import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterResellerRequestDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name!: string;

  @IsIn(['pf', 'pj'])
  type!: 'pf' | 'pj';

  @IsDateString()
  birthDate!: string;

  @IsString()
  @Matches(/^[0-9]{11,14}$/, {
    message: 'CPF deve conter apenas números (11 a 14 dígitos)',
  })
  cpf!: string;

  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsString()
  @Length(10, 20)
  phone?: string;

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
  @Matches(/^[0-9]{11,14}$/, {
    message: 'CPF do titular deve conter apenas números (11 a 14 dígitos)',
  })
  bankHolderCpf?: string;

  @IsOptional()
  @IsString()
  pixKey?: string;

  @IsOptional()
  @IsIn(['cpf', 'email', 'phone', 'random'])
  pixKeyType?: 'cpf' | 'email' | 'phone' | 'random';

  @IsNotEmpty()
  @Matches(/^\d{8}$/, {
    message: 'CEP deve conter 8 dígitos numéricos',
  })
  zipCode!: string;

  @IsNotEmpty()
  @IsString()
  street!: string;

  @IsNotEmpty()
  @IsString()
  number!: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsNotEmpty()
  @IsString()
  neighborhood!: string;

  @IsNotEmpty()
  @IsString()
  city!: string;

  @IsNotEmpty()
  @IsString()
  @Length(2, 2)
  state!: string;
}
