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
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ContentClassification } from '../../../../../contexts/content/domain/value-objects/content-classification.vo';
import { ContentOrigin } from '../../../../../contexts/content/domain/value-objects/content-origin.vo';
import { ContentStatus } from '../../../../../contexts/content/domain/value-objects/content-status.vo';

/** WhatsApp caps a text message around 4096 characters; anything longer is a mistake, not a message. */
const MAX_BODY_LENGTH = 4000;

/** ~20 MB of file becomes ~27 MB of base64; the Fastify body limit is 25 MB, so cap below it. */
const MAX_BASE64_LENGTH = 24_000_000;

export class CreateContentRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  /**
   * MANDATORY, no default (§1.3). `@IsEnum` on a required field is what makes "sem default, sem nulo"
   * true at the HTTP edge as well as in the domain.
   */
  @IsEnum(ContentClassification, {
    message: 'Classificação obrigatória: INSTITUTIONAL ou ELECTORAL.',
  })
  classification!: ContentClassification;

  @IsEnum(ContentOrigin, { message: 'Origem inválida: use MANUAL ou PDF.' })
  origin!: ContentOrigin;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_BODY_LENGTH)
  bodyBase!: string;

  /** The Instagram permalink, for instance. Nothing in the system fetches content from it. */
  @IsOptional()
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'source_url inválida.' },
  )
  @MaxLength(500)
  sourceUrl?: string | null;

  /** Appends the link to the message the contact receives. Off unless asked for. */
  @IsOptional()
  @IsBoolean()
  includeSourceUrl?: boolean;
}

export class UpdateContentRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_BODY_LENGTH)
  bodyBase?: string;

  @IsOptional()
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'source_url inválida.' },
  )
  @MaxLength(500)
  sourceUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  includeSourceUrl?: boolean;

  // `classification` is absent on purpose: it is decided at creation and never edited. Changing it
  // would silently relabel a message that was already approved as the other kind (§15 risco 6).
}

export class AddVariantRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  label!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_BODY_LENGTH)
  body!: string;
}

export class UpdateVariantRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_BODY_LENGTH)
  body?: string;

  /** Records that a human reviewed this wording (§7 item 5). Never set by a machine. */
  @IsOptional()
  @IsBoolean()
  markReviewed?: boolean;
}

export class AttachMediaRequestDto {
  /** Null/absent → attaches to the content itself rather than to one variant. */
  @IsOptional()
  @IsUUID()
  variantId?: string | null;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  fileName!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  /** Base64 in JSON — Fastify, never multipart (CLAUDE.md, §7 item 4). */
  @IsString()
  @MinLength(8)
  @MaxLength(MAX_BASE64_LENGTH)
  fileBase64!: string;
}

export class ListContentsQueryDto {
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
  @IsEnum(ContentStatus, { message: 'Status inválido.' })
  status?: ContentStatus;

  @IsOptional()
  @IsEnum(ContentClassification, { message: 'Classificação inválida.' })
  classification?: ContentClassification;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}

export class PreviewContentQueryDto {
  /** Narrows the sample to the audience that will actually receive it (§7.4). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  tags?: string[];
}

export class ArchiveContentRequestDto {
  /** Archiving is permanent: the content becomes read-only forever. */
  @Matches(/^(true|1|yes|sim)$/i, { message: 'Confirmação obrigatória para arquivar.' })
  confirm!: string;
}
