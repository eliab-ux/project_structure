import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AccountPlan } from '../../../../../contexts/account/domain/value-objects/account-plan.vo';
import { AccountStatus } from '../../../../../contexts/account/domain/value-objects/account-status.vo';
import { PASSWORD_POLICY } from '../../../../../contexts/auth/domain/password-policy';

/** Upper bound on any ceiling accepted over HTTP — a typo of 100000 must not become policy. */
const MAX_DAILY_CEILING = 100_000;

export class PlatformLoginRequestDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_POLICY.maxLength)
  password!: string;
}

export class CreateAccountRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  /** CPF or CNPJ; punctuation allowed and stripped by the Document value object. */
  @IsString()
  @Matches(/^[\d.\-/\s]{11,20}$/, { message: 'Documento inválido.' })
  document!: string;

  @IsEnum(AccountPlan, { message: 'Plano inválido.' })
  plan!: AccountPlan;

  /**
   * Explicit, not derived from the plan: the plan → ceiling table is DECISÃO PENDENTE
   * (§14, item 8), so the caller states the number rather than inheriting a guess.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_DAILY_CEILING)
  dailySendCeiling!: number;

  /** IANA timezone — quiet hours and the account's calendar day are computed in it. */
  @IsString()
  @Matches(/^[A-Za-z]+\/[A-Za-z_+\-0-9]+$/, {
    message: 'Timezone inválido (ex.: America/Sao_Paulo).',
  })
  @MaxLength(64)
  timezone!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  adminName!: string;

  @IsEmail({}, { message: 'E-mail do administrador inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  adminEmail!: string;

  /**
   * WhatsApp of the first admin — REQUIRED (CLAUDE.md regra 9). Recovery is a code sent here, and
   * this admin has nobody above them in the tenant to reset it.
   */
  @IsString()
  @Matches(/^\+?[\d\s().-]{10,20}$/, {
    message: 'WhatsApp do administrador inválido. Use DDD + número, ex.: (11) 99999-9999.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  adminPhone!: string;

  @IsString()
  @MinLength(PASSWORD_POLICY.minLength)
  @MaxLength(PASSWORD_POLICY.maxLength)
  adminPassword!: string;
}

export class SuspendAccountRequestDto {
  /**
   * Required and substantial: the tenant reads this string on their own screen to understand why
   * nothing is sending, so "abuso" alone is not an answer.
   */
  @IsString()
  @MinLength(10, { message: 'Descreva o motivo da suspensão (mínimo 10 caracteres).' })
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason!: string;
}

export class ChangeDailyCeilingRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_DAILY_CEILING)
  dailySendCeiling!: number;
}

export class AssignEvolutionServerRequestDto {
  /** Both null → back to the shared platform server. */
  @IsOptional()
  @ValidateIf((dto: AssignEvolutionServerRequestDto) => dto.serverUrl !== null)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'URL inválida.' })
  @MaxLength(300)
  serverUrl!: string | null;

  @IsOptional()
  @ValidateIf((dto: AssignEvolutionServerRequestDto) => dto.apiKey !== null)
  @IsString()
  @MinLength(8)
  @MaxLength(300)
  apiKey!: string | null;
}

export class ListAccountsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsEnum(AccountStatus, { message: 'Status inválido.' })
  status?: AccountStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}

export class AbuseSignalsQueryDto {
  /** Inclusive window. Dates only (YYYY-MM-DD) — the signals are daily snapshots. */
  @IsISO8601({ strict: true }, { message: 'Data inicial inválida (YYYY-MM-DD).' })
  from!: string;

  @IsISO8601({ strict: true }, { message: 'Data final inválida (YYYY-MM-DD).' })
  to!: string;
}
