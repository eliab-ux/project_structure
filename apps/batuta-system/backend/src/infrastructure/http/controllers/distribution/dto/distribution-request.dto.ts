import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DistributionStatus } from '../../../../../contexts/distribution/domain/value-objects/distribution-status.vo';

/** Tags are operator-authored labels; the pattern keeps them to something a URL and a log can carry. */
const TAG_PATTERN = /^[a-z0-9à-ÿ][a-z0-9à-ÿ _-]{0,39}$/i;

export class VariantMappingRequestDto {
  @IsUUID()
  variantId!: string;

  @IsString()
  @Matches(TAG_PATTERN, { message: 'Tag inválida no mapeamento de variante.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  tag!: string;
}

export class PlanDistributionRequestDto {
  @IsUUID()
  contentId!: string;

  /** ISO 8601 with timezone. The quiet-hours conversion happens server-side, in the account's zone. */
  @IsDateString()
  windowStart!: string;

  @IsDateString()
  windowEnd!: string;

  /** Empty means the whole routable base — see TargetFilter for why that is expressible. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(TAG_PATTERN, { each: true, message: 'Tag inválida.' })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => VariantMappingRequestDto)
  variantMappings?: VariantMappingRequestDto[];
}

export class ConfirmDistributionRequestDto {
  /**
   * The `content_hash` shown in the preview.
   *
   * Optional in the schema, enforced when present: it is what stops confirming a plan built from text
   * that has since been edited (§8.5). The UI always sends it.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{64}$/, { message: 'content_hash inválido.' })
  expectedContentHash?: string;
}

export class ListDistributionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(DistributionStatus)
  status?: DistributionStatus;

  @IsOptional()
  @IsUUID()
  contentId?: string;
}

export class CancelDistributionRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason?: string;
}

/** Placeholder body so pause/resume are POSTs with a validated (empty) payload, not free-form. */
export class DistributionControlRequestDto {
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
