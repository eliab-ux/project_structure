import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ConsentBasis } from '../../../../../contexts/audience/domain/value-objects/consent-basis.vo';
import { MigrationStrategy } from '../../../../../contexts/audience/domain/value-objects/migration-strategy.vo';

/** ~15 MB of raw file becomes ~20 MB of base64; the Fastify body limit is 25 MB. */
const MAX_BASE64_LENGTH = 21_000_000;

export class ColumnMappingDto {
  /** Header name, or a 0-based index when the file has no header. Mandatory (§6.1 item 2). */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string | null;

  /** One column with comma/semicolon/pipe-separated tags. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tags?: string | null;
}

export class StartContactImportRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  @Matches(/\.(csv|xlsx)$/i, { message: 'Envie um arquivo .csv ou .xlsx.' })
  fileName!: string;

  @IsString()
  @MaxLength(200)
  fileMimeType!: string;

  /** Base64 in JSON — Fastify, never multipart (CLAUDE.md). */
  @IsString()
  @MinLength(8)
  @MaxLength(MAX_BASE64_LENGTH)
  fileBase64!: string;

  /**
   * §6.1 item 6: provenance is MANDATORY. Without these two the import is rejected — here, at the
   * domain, and by a CHECK constraint in the database.
   */
  @IsEnum(ConsentBasis, { message: 'Base de consentimento inválida.' })
  consentBasis!: ConsentBasis;

  @IsString()
  @MinLength(10, {
    message:
      'Descreva a origem da lista (mínimo 10 caracteres) — é o que responde de onde ela veio.',
  })
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  originNote!: string;

  @ValidateNested()
  @Type(() => ColumnMappingDto)
  mapping!: ColumnMappingDto;

  @IsOptional()
  @IsBoolean()
  hasHeader: boolean = true;
}

export class ListContactsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  tags?: string[];

  @IsOptional()
  @IsUUID()
  channelId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  optedOut?: boolean;

  /** Matches the name. The phone is deliberately not searchable by fragment. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}

export class MigrationPreviewQueryDto {
  @IsUUID()
  fromChannelId!: string;

  @IsEnum(MigrationStrategy, { message: 'Estratégia inválida.' })
  strategy!: MigrationStrategy;

  /** Required for ALL_TO_ONE, forbidden for REDISTRIBUTE — the domain enforces both. */
  @IsOptional()
  @IsUUID()
  toChannelId?: string;
}

export class ExecuteMigrationRequestDto {
  @IsUUID()
  fromChannelId!: string;

  @IsEnum(MigrationStrategy, { message: 'Estratégia inválida.' })
  strategy!: MigrationStrategy;

  @IsOptional()
  @IsUUID()
  toChannelId?: string;

  /**
   * Explicit confirmation. Migration is irreversible in practice (§6.4) and moves every contact of a
   * chip, so the client has to say it meant it.
   */
  @Matches(/^(true|1|yes|sim)$/i, { message: 'Confirmação obrigatória para migrar remetente.' })
  confirm!: string;
}

export class OptOutRequestDto {
  /** Opt-out is permanent and irreversible by the UI (§6.5) — confirmation is not a formality. */
  @Matches(/^(true|1|yes|sim)$/i, { message: 'Confirmação obrigatória: o opt-out é irreversível.' })
  confirm!: string;
}
