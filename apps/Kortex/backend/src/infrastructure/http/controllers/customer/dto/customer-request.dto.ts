import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DOCUMENT_TYPES } from '../../../../../contexts/customer/domain/value-objects/customer-document.vo';
import { COMPANY_SIZES } from '../../../../../contexts/customer/domain/entities/customer.entity';
import { REPRESENTATIVE_ROLES } from '../../../../../contexts/customer/domain/value-objects/legal-representative.vo';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Aceita com máscara e guarda sem: `11.222.333/0001-81` e `11222333000181` são o mesmo cadastro. */
const digitsOnly = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;

/**
 * Cadastro de cliente. **Todos os campos validados** — o DoD da Fase 2 é explícito, e um campo sem
 * decorator aqui é um campo que atravessa o `ValidationPipe` sem ninguém olhar.
 *
 * A validação de dígito verificador do documento e do CPF do representante NÃO está aqui: é
 * invariante de domínio e vive nos Value Objects (`CustomerDocument`, `CPF`). Esta camada rejeita
 * o malformado; a de domínio garante o que é regra de negócio (CLAUDE.md, duas camadas).
 */
export class CustomerRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trim)
  legalName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trim)
  tradeName!: string;

  @IsIn(DOCUMENT_TYPES, { message: 'Tipo de documento deve ser cnpj ou cpf.' })
  documentType!: string;

  @IsString()
  @Matches(/^(\d{11}|\d{14})$/, { message: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos.' })
  @Transform(digitsOnly)
  document!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(trim)
  stateRegistration?: string | null;

  @IsOptional()
  @IsIn(COMPANY_SIZES, { message: `Porte deve ser um de: ${COMPANY_SIZES.join(', ')}.` })
  companySize?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  employeesCount?: number | null;

  // ==== Endereço ====
  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, { message: 'CEP deve ter 8 dígitos.' })
  @Transform(digitsOnly)
  zipCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trim)
  street?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(trim)
  number?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  complement?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  district?: string | null;

  /** Obrigatória: é coluna do relatório mensal do governo (spec §4.4). */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trim)
  city!: string;

  @IsString()
  @Matches(/^[A-Za-z]{2}$/, { message: 'UF deve ter 2 letras.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  state!: string;

  // ==== Representante legal ====
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trim)
  repName!: string;

  @IsOptional()
  @IsIn(REPRESENTATIVE_ROLES, {
    message: `Cargo deve ser um de: ${REPRESENTATIVE_ROLES.join(', ')}.`,
  })
  repRole?: string | null;

  @IsString()
  @Matches(/^\d{11}$/, { message: 'CPF do representante deve ter 11 dígitos.' })
  @Transform(digitsOnly)
  repCpf!: string;

  @IsString()
  @MinLength(10, { message: 'Informe o WhatsApp do representante com DDD.' })
  @MaxLength(20)
  @Transform(trim)
  repPhone!: string;

  @IsEmail({}, { message: 'E-mail do representante inválido.' })
  @MaxLength(255)
  @Transform(normalizeEmail)
  repEmail!: string;

  // ==== Contato da empresa ====
  @IsString()
  @MinLength(10, { message: 'Informe o WhatsApp da empresa com DDD.' })
  @MaxLength(20)
  @Transform(trim)
  whatsapp!: string;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail da empresa inválido.' })
  @MaxLength(255)
  @Transform(normalizeEmail)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  @Transform(trim)
  phone?: string | null;

  // ==== Associação ====
  @IsOptional()
  @IsBoolean()
  isMember?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use o formato AAAA-MM-DD.' })
  memberSince?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trim)
  notes?: string | null;
}

export class SetCustomerStatusRequestDto {
  @IsBoolean()
  active!: boolean;
}
