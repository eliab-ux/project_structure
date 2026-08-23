import { Transform } from 'class-transformer';
import {
  IsBase64,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EVIDENCE_TYPES } from '../../../../../contexts/route/domain/entities/order-evidence.entity';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterOrderEvidenceRequestDto {
  @IsIn(EVIDENCE_TYPES as unknown as string[])
  type!: string;

  @IsOptional()
  @IsUUID()
  tripId?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  /** Binário da FOTO (comprimida no aparelho) — base64 em JSON (Fastify; nunca multipart). */
  @IsOptional()
  @IsBase64()
  fileBase64?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimmed)
  fileMimeType?: string | null;

  @IsOptional()
  @IsISO8601()
  capturedAt?: string;
}

export class ChangeOrderGpsRequestDto {
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude!: number;

  /** O MOTIVO da alteração — parte da trilha auditada (aceite 2 do 04). */
  @IsString()
  @MinLength(5, { message: 'Informe o motivo da alteração do GPS.' })
  @MaxLength(300)
  @Transform(trimmed)
  reason!: string;
}

export class GeneratePromissoryRequestDto {
  /** Vencimento ≈ próxima passagem pela rota. */
  @IsISO8601()
  dueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(trimmed)
  debtorAddress?: string | null;
}
