import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ChannelStatus } from '../../../../../contexts/channel/domain/value-objects/channel-status.vo';

/** Sanity bound on any quota accepted over HTTP. The throttle moves inside the band; this caps it. */
const MAX_QUOTA = 5_000;

export class CreateChannelRequestDto {
  /** What the operator calls this chip. Shown everywhere instead of the phone number. */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  label!: string;

  /**
   * Accepts what an operator types; the PhoneE164 value object normalises it. The regex only keeps
   * obvious junk out — the real validation is the value object, and it is the one that decides.
   */
  @IsString()
  @Matches(/^[+\d()\s-]{10,20}$/, { message: 'Telefone inválido.' })
  phone!: string;

  /** Omitted → the configured default band (DECISÃO PENDENTE §14 item 1: 20/150). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QUOTA)
  quotaFloor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QUOTA)
  quotaCeiling?: number;

  // No accountId: the tenant comes from the JWT, and forbidNonWhitelisted rejects one if sent.
}

/**
 * Only the band. There is deliberately no `currentQuota` field anywhere in the HTTP surface —
 * the current quota belongs to the daily job (§2.1).
 */
export class UpdateQuotaBandRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QUOTA)
  quotaFloor!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QUOTA)
  quotaCeiling!: number;
}

/** Terminal states demand a written reason: without one the trail cannot answer "why". */
export class TerminalStateRequestDto {
  @IsString()
  @MinLength(10, { message: 'Descreva o motivo (mínimo 10 caracteres).' })
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason!: string;

  /**
   * Explicit confirmation, required by §5 FASE 2 item 5. A terminal state is irreversible and makes
   * contacts migratable, so the client has to say it meant it.
   */
  @Matches(/^(true|1|yes|sim)$/i, { message: 'Confirmação obrigatória para estado terminal.' })
  confirm!: string;
}

export class ListChannelsQueryDto {
  @IsOptional()
  @IsEnum(ChannelStatus, { message: 'Status inválido.' })
  status?: ChannelStatus;
}

export class ChannelHealthQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days: number = 14;
}

export class WebhookDiagnosisRequestDto {
  /**
   * True → reasserts the webhook on the provider before reading it back.
   *
   * Defaults to false so the diagnosis can be read without changing anything: a screen that silently
   * repaired what it was asked to inspect would never let anyone see the fault.
   */
  @IsOptional()
  @IsBoolean()
  reconfigure?: boolean;
}
