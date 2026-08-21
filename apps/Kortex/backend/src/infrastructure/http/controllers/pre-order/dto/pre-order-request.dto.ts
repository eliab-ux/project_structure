import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import { LAYOUT_TYPES } from '../../../../../shared/domain/value-objects/layout-type';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Uma matriz declarada no pedido (§4.7.1).
 *
 * Tecido e produto ficam **aqui** e não no pedido: matriz 1 tecido X calça, matriz 2 tecido Y
 * camiseta é o caso real do cliente, e um par de campos no topo não teria onde pôr o segundo.
 */
export class PreOrderMatrizRequestDto {
  /** FK, não texto: é a altura máxima do tecido que sustenta a estimativa (spec §4.5). */
  @IsUUID('4', { message: 'Selecione um tecido cadastrado.' })
  fabricId!: string;

  @IsUUID('4', { message: 'Selecione um tipo de produto.' })
  productTypeId!: string;

  @IsInt()
  @Min(1, { message: 'Informe quantas peças o cliente quer cortar nesta matriz.' })
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
}

export class PreOrderRequestDto {
  @IsUUID('4', { message: 'Selecione um cliente.' })
  customerId!: string;

  /**
   * As matrizes do pedido. **Ao menos uma** — pedido sem matriz não descreve trabalho nenhum, e é
   * esta lista que limita quantos apontamentos o Modelista poderá abrir na reserva (§4.10).
   *
   * `ValidateNested` + `Type` são obrigatórios: sem eles o `class-validator` aceita a lista sem
   * olhar dentro, e um objeto qualquer chegaria ao domínio.
   */
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos uma matriz.' })
  @ArrayMaxSize(20, { message: 'Um pedido comporta no máximo 20 matrizes.' })
  @ValidateNested({ each: true })
  @Type(() => PreOrderMatrizRequestDto)
  matrizes!: PreOrderMatrizRequestDto[];

  /**
   * Horas do **pedido inteiro** — o cliente compra um bloco de máquina, não uma hora por matriz.
   *
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
