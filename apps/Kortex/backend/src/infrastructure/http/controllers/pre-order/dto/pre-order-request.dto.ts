import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { LAYOUT_TYPES } from '../../../../../shared/domain/value-objects/layout-type';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class PreOrderRequestDto {
  @IsUUID('4', { message: 'Selecione um cliente.' })
  customerId!: string;

  /** FK, não texto: é a altura máxima do tecido que sustenta a estimativa (spec §4.5). */
  @IsUUID('4', { message: 'Selecione um tecido cadastrado.' })
  fabricId!: string;

  @IsUUID('4', { message: 'Selecione um tipo de produto.' })
  productTypeId!: string;

  @IsInt()
  @Min(1, { message: 'Informe quantas peças o cliente quer cortar.' })
  @Max(1_000_000)
  estimatedPieces!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Use até três casas decimais.' })
  @Min(0.001)
  @Max(9999)
  metersPerPiece?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  rolls?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  estimatedLayers?: number | null;

  @IsOptional()
  @IsIn(LAYOUT_TYPES, { message: `Tipo de enfesto deve ser um de: ${LAYOUT_TYPES.join(', ')}.` })
  estimatedLayoutType?: string | null;

  /**
   * O número que o Administrativo recebe pronto. Quem o define é o Modelista (§4.7, §5) — a
   * permissão é verificada no use case e na entidade, não aqui.
   */
  @IsInt()
  @Min(1, { message: 'A reserva é vendida em hora cheia: mínimo de 1 hora.' })
  @Max(24)
  estimatedHours!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trim)
  notes?: string | null;
}

export class SlotNoticeRequestDto {
  @IsString()
  @MinLength(3, { message: 'Escreva o recado para o Administrativo.' })
  @MaxLength(500)
  @Transform(trim)
  note!: string;
}

export class WaitingListRequestDto {
  @IsUUID('4', { message: 'Selecione um cliente.' })
  customerId!: string;

  @IsOptional()
  @IsUUID('4')
  preOrderId?: string | null;

  @IsOptional()
  @IsUUID('4')
  fabricId?: string | null;

  @IsOptional()
  @IsUUID('4')
  productTypeId?: string | null;

  @IsInt()
  @Min(1)
  @Max(24)
  hoursNeeded!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trim)
  technicalNotes?: string | null;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  wantsEarlier?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use o formato AAAA-MM-DD.' })
  desiredUntil?: string | null;
}
