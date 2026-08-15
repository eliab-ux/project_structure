import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CONTACT_TYPES, PERSON_KINDS } from '../../../../../contexts/contact/domain/contact-types';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const onlyDigits = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;

/**
 * Um e-mail do contato. Sem `id`: a lista é substituída inteira a cada gravação — ver o docblock do
 * `UpdateContactUseCase`.
 */
export class ContactEmailRequestDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimmed)
  label?: string | null;
}

export class ContactPhoneRequestDto {
  /** Dígitos; o VO `PhoneE164` normaliza para `+55…`. A máscara da tela chega e é descartada. */
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  @Transform(onlyDigits)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimmed)
  label?: string | null;

  @IsOptional()
  @IsBoolean()
  isWhatsapp?: boolean;
}

export class ContactAddressRequestDto {
  @IsIn(['main', 'billing', 'delivery'])
  purpose!: 'main' | 'billing' | 'delivery';

  @IsString() @MinLength(2) @MaxLength(200) @Transform(trimmed) street!: string;
  @IsString() @MinLength(1) @MaxLength(20) @Transform(trimmed) number!: string;

  @IsOptional() @IsString() @MaxLength(100) @Transform(trimmed) complement?: string | null;

  @IsString() @MinLength(2) @MaxLength(100) @Transform(trimmed) district!: string;
  @IsString() @MinLength(2) @MaxLength(120) @Transform(trimmed) city!: string;

  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'UF deve ter 2 letras maiúsculas.' })
  state!: string;

  @IsString()
  @Matches(/^\d{8}$/, { message: 'CEP deve ter 8 dígitos.' })
  @Transform(onlyDigits)
  zipCode!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{7}$/, { message: 'Código IBGE deve ter 7 dígitos.' })
  @Transform(onlyDigits)
  ibgeCityCode?: string | null;
}

/**
 * Criação de contato.
 *
 * ⚠️ **Não existe campo de vendedor vinculado**, e nunca deve ser acrescentado sem a carteirização
 * inteira junto — coluna, preferência e filtro. Ver o docblock da entidade `Contact`.
 */
export class CreateContactRequestDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um tipo.' })
  @ArrayMaxSize(4)
  @IsIn(CONTACT_TYPES as unknown as string[], { each: true })
  types!: string[];

  @IsIn(PERSON_KINDS as unknown as string[])
  personKind!: string;

  @IsString() @MinLength(2) @MaxLength(200) @Transform(trimmed) legalName!: string;

  @IsOptional() @IsString() @MaxLength(200) @Transform(trimmed) tradeName?: string | null;

  /** CPF ou CNPJ, só dígitos. O VO `Document` valida os dígitos verificadores. */
  @IsOptional()
  @IsString()
  @Matches(/^(\d{11}|\d{14})$/, { message: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos.' })
  @Transform(onlyDigits)
  document?: string | null;

  @IsOptional() @IsString() @MaxLength(30) @Transform(trimmed) stateRegistration?: string | null;
  @IsOptional() @IsString() @MaxLength(30) @Transform(trimmed) code?: string | null;

  /**
   * Limite de crédito. **Registrado, não aplicado nesta fase** — a tela diz isso ao operador (ver o
   * `hint` no catálogo de campos). O teto de 999 milhões evita que um erro de digitação vire um
   * número que nenhuma tela consegue formatar.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Limite de crédito com no máximo 2 casas.' })
  @Min(0)
  @Max(999_999_999)
  creditLimit?: number | null;

  @IsOptional() @IsString() @MaxLength(2000) @Transform(trimmed) notes?: string | null;

  // ── Opcionais do §3.4 ───────────────────────────────────────────────────────────────────────
  @IsOptional() @IsString() @MaxLength(30) @Transform(trimmed) municipalRegistration?:
    string | null;
  @IsOptional() @IsString() @MaxLength(30) @Transform(trimmed) suframa?: string | null;
  @IsOptional() @IsString() @MaxLength(30) @Transform(trimmed) gln?: string | null;
  @IsOptional() @IsString() @MaxLength(140) @Transform(trimmed) pixKey?: string | null;
  @IsOptional() @IsString() @MaxLength(200) @Transform(trimmed) website?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ContactEmailRequestDto)
  emails?: ContactEmailRequestDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ContactPhoneRequestDto)
  phones?: ContactPhoneRequestDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ContactAddressRequestDto)
  addresses?: ContactAddressRequestDto[];
}

/** Alteração: tudo opcional, mais o `active`. `code` não é imutável — diferente de `document`. */
export class UpdateContactRequestDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsIn(CONTACT_TYPES as unknown as string[], { each: true })
  types?: string[];

  @IsOptional() @IsIn(PERSON_KINDS as unknown as string[]) personKind?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) @Transform(trimmed) legalName?: string;
  @IsOptional() @IsString() @MaxLength(200) @Transform(trimmed) tradeName?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^(\d{11}|\d{14})$/, { message: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos.' })
  @Transform(onlyDigits)
  document?: string | null;

  @IsOptional() @IsString() @MaxLength(30) @Transform(trimmed) stateRegistration?: string | null;
  @IsOptional() @IsString() @MaxLength(30) @Transform(trimmed) code?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999)
  creditLimit?: number | null;

  @IsOptional() @IsString() @MaxLength(2000) @Transform(trimmed) notes?: string | null;
  @IsOptional() @IsString() @MaxLength(30) @Transform(trimmed) municipalRegistration?:
    string | null;
  @IsOptional() @IsString() @MaxLength(30) @Transform(trimmed) suframa?: string | null;
  @IsOptional() @IsString() @MaxLength(30) @Transform(trimmed) gln?: string | null;
  @IsOptional() @IsString() @MaxLength(140) @Transform(trimmed) pixKey?: string | null;
  @IsOptional() @IsString() @MaxLength(200) @Transform(trimmed) website?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ContactEmailRequestDto)
  emails?: ContactEmailRequestDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ContactPhoneRequestDto)
  phones?: ContactPhoneRequestDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ContactAddressRequestDto)
  addresses?: ContactAddressRequestDto[];
}

/** Filtros da listagem. `type` casa com o filtro por tipo do §5 do CORE. */
export class ListContactsQueryDto {
  @IsOptional() @IsString() @MaxLength(120) @Transform(trimmed) search?: string;

  @IsOptional() @IsIn(CONTACT_TYPES as unknown as string[]) type?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}
