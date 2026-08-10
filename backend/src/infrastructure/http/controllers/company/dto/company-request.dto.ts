import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BRAZILIAN_STATES } from '../../../../../shared/domain/value-objects/address.vo';
import { TaxRegime } from '../../../../../contexts/company/domain/value-objects/tax-regime.vo';

/** Strips everything that is not a digit — CNPJ, CEP, IE and IBGE code are all stored unformatted. */
const onlyDigits = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AddressRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Logradouro é obrigatório.' })
  @MaxLength(200)
  @Transform(trimmed)
  street!: string;

  @IsString()
  @IsNotEmpty({ message: 'Número é obrigatório.' })
  @MaxLength(20)
  @Transform(trimmed)
  number!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimmed)
  complement?: string | null;

  @IsString()
  @IsNotEmpty({ message: 'Bairro é obrigatório.' })
  @MaxLength(100)
  @Transform(trimmed)
  district!: string;

  @IsString()
  @IsNotEmpty({ message: 'Cidade é obrigatória.' })
  @MaxLength(120)
  @Transform(trimmed)
  city!: string;

  @IsIn(BRAZILIAN_STATES as unknown as string[], { message: 'UF inválida.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  state!: string;

  @IsString()
  @Matches(/^\d{8}$/, { message: 'CEP deve ter 8 dígitos.' })
  @Transform(onlyDigits)
  zipCode!: string;

  /** Required by NF-e. Optional at the API so a company can be created before it is looked up. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{7}$/, { message: 'Código IBGE do município deve ter 7 dígitos.' })
  @Transform(onlyDigits)
  ibgeCityCode?: string | null;
}

export class StateRegistrationRequestDto {
  @IsIn(BRAZILIAN_STATES as unknown as string[], { message: 'UF inválida.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  state!: string;

  @IsString()
  @Length(2, 20)
  @Transform(onlyDigits)
  registration!: string;
}

export class CreateCompanyRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trimmed)
  legalName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trimmed)
  tradeName?: string | null;

  /** Check digits are verified by the `Document` value object — this only guarantees the shape. */
  @IsString()
  @Matches(/^\d{14}$/, { message: 'CNPJ deve ter 14 dígitos.' })
  @Transform(onlyDigits)
  document!: string;

  @IsIn(Object.values(TaxRegime), { message: 'Regime tributário inválido.' })
  taxRegime!: string;

  @IsBoolean({ message: 'Informe se a empresa é isenta de Inscrição Estadual.' })
  stateRegistrationExempt!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(onlyDigits)
  stateRegistration?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(trimmed)
  municipalRegistration?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(trimmed)
  suframa?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(onlyDigits)
  cnae?: string | null;

  @ValidateNested()
  @Type(() => AddressRequestDto)
  address!: AddressRequestDto;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail de contato inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  contactEmail?: string | null;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail de cobrança inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  billingEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(trimmed)
  phone?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StateRegistrationRequestDto)
  stateRegistrations?: StateRegistrationRequestDto[];
}

/**
 * Every field optional — this is a partial update. `document` is absent entirely and not merely
 * optional: changing a company's CNPJ is not an edit, it is a different company with different
 * fiscal numbering and a different invoice history.
 */
export class UpdateCompanyRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trimmed)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trimmed)
  tradeName?: string | null;

  @IsOptional()
  @IsIn(Object.values(TaxRegime), { message: 'Regime tributário inválido.' })
  taxRegime?: string;

  @IsOptional()
  @IsBoolean()
  stateRegistrationExempt?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(onlyDigits)
  stateRegistration?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(trimmed)
  municipalRegistration?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(trimmed)
  suframa?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(onlyDigits)
  cnae?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressRequestDto)
  address?: AddressRequestDto;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail de contato inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  contactEmail?: string | null;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail de cobrança inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  billingEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(trimmed)
  phone?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StateRegistrationRequestDto)
  stateRegistrations?: StateRegistrationRequestDto[];
}

export class SetCompanyStatusRequestDto {
  @IsBoolean()
  active!: boolean;
}
