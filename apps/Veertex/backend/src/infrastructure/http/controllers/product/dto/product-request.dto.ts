import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
import {
  COMMERCIAL_UNITS,
  PRODUCT_CONDITIONS,
  PRODUCT_FORMATS,
  PRODUCT_KINDS,
  PRODUCT_ORIGINS,
} from '../../../../../contexts/product/domain/product-types';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const onlyDigits = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const UNIDADE_INVALIDA = `Unidade deve ser uma das siglas: ${COMMERCIAL_UNITS.join(', ')}.`;

/**
 * Um fornecedor do produto. Sem `id`: a lista é substituída inteira a cada gravação — mesma
 * semântica das coleções do contato, e a razão está no `MikroOrmProductRepository.save`.
 */
export class ProductSupplierRequestDto {
  /** O contato. Que ele TEM o tipo `supplier` é verificado no use case, que alcança o banco. */
  @IsUUID('4', { message: 'Fornecedor inválido.' })
  contactId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trimmed)
  supplierDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimmed)
  supplierSku?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost?: number | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/**
 * A base de criação e edição.
 *
 * Herdar em vez de repetir não é economia de linhas: duas listas do mesmo conjunto divergem na
 * primeira alteração, e o campo esquecido em uma delas passaria a ser silenciosamente ignorado
 * naquele caminho — "salva na criação e some na edição".
 *
 * **Não existe campo `accountId`**, aqui nem em DTO nenhum deste sistema: a conta vem do TOKEN. Se o
 * cliente pudesse dizer de quem é o dado, ele diria.
 *
 * **Não existe campo `cfop`.** §3.5, explícito — ver o catálogo de campos.
 */
export class ProductBaseRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimmed)
  sku?: string | null;

  @IsOptional()
  @IsIn(PRODUCT_KINDS, { message: 'Tipo deve ser "product" ou "service".' })
  kind?: string;

  @IsOptional()
  @IsIn(PRODUCT_CONDITIONS, { message: 'Condição deve ser "new" ou "used".' })
  condition?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  basePrice?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimmed)
  brand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(trimmed)
  categoryPath?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  ownProduction?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36500)
  shelfLifeDays?: number | null;

  /** GTIN/EAN — dígitos. Zero à esquerda é significativo, por isso texto e não número. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{8,14}$/, { message: 'GTIN/EAN deve ter de 8 a 14 dígitos.' })
  @Transform(onlyDigits)
  barcode?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{14}$/, { message: 'DUN-14 deve ter 14 dígitos.' })
  @Transform(onlyDigits)
  dun14?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimmed)
  shortDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  @Transform(trimmed)
  longDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimmed)
  externalUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimmed)
  videoUrl?: string | null;

  // ── Medidas ──────────────────────────────────────────────────────────────────────────────────
  // Três casas: 0,125 kg é peso comum de item pequeno, e arredondar erraria a cotação de frete.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  netWeightKg?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  grossWeightKg?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  widthCm?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  heightCm?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  lengthCm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  itemsPerBox?: number | null;

  // ── Parâmetros de estoque (SALDO é do EST, e não existe aqui) ────────────────────────────────
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  minimumQuantity?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  maximumQuantity?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimmed)
  location?: string | null;

  // ── Tributação: só dado do produto ───────────────────────────────────────────────────────────
  @IsOptional()
  @IsIn(PRODUCT_ORIGINS, { message: 'Origem da mercadoria deve ser um código de 0 a 8.' })
  origin?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, { message: 'NCM deve ter 8 dígitos.' })
  @Transform(onlyDigits)
  ncm?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{7}$/, { message: 'CEST deve ter 7 dígitos.' })
  @Transform(onlyDigits)
  cest?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimmed)
  itemType?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  approximateTaxPercent?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimmed)
  taxGroup?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{8,14}$/, { message: 'GTIN tributável deve ter de 8 a 14 dígitos.' })
  @Transform(onlyDigits)
  taxableBarcode?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProductSupplierRequestDto)
  suppliers?: ProductSupplierRequestDto[];
}

export class CreateProductRequestDto extends ProductBaseRequestDto {
  @IsString()
  @MinLength(2, { message: 'Nome do produto é obrigatório.' })
  @MaxLength(200)
  @Transform(trimmed)
  name!: string;

  /** Obrigatória na criação: sem unidade, o item não entra em pedido nem em nota. */
  @IsIn(COMMERCIAL_UNITS, { message: UNIDADE_INVALIDA })
  @Transform(upper)
  unit!: string;

  /**
   * `simple` é o único aceito, e a recusa dos outros dois é do DOMÍNIO, não deste decorator.
   *
   * O `@IsIn` aqui aceita os três de propósito: quem tentar criar um kit recebe a mensagem de
   * negócio ("kit depende do módulo de Estoque, que baixa os componentes ao vender") em vez de
   * "valor inválido". A diferença é entre uma mensagem que explica e uma que faz o operador tentar
   * de novo com outra grafia.
   */
  @IsOptional()
  @IsIn(PRODUCT_FORMATS)
  format?: string;
}

/**
 * Edição — tudo opcional, e a distinção entre ausente e nulo importa.
 *
 * Campo **ausente** = "não mexa". Campo **`null`** = "apague". É o que permite a tela mandar só o
 * que mudou sem apagar o resto — ver `paraDominio`.
 *
 * **`format` não está aqui**: converter `simple` em `bundle` num produto com histórico o
 * transformaria numa estrutura de composição que não existe. Quando o EST chegar, a conversão será
 * operação própria, com regra sua.
 */
export class UpdateProductRequestDto extends ProductBaseRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trimmed)
  name?: string;

  @IsOptional()
  @IsIn(COMMERCIAL_UNITS, { message: UNIDADE_INVALIDA })
  @Transform(upper)
  unit?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ListProductsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimmed)
  search?: string;

  @IsOptional()
  @IsIn(PRODUCT_KINDS)
  kind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(trimmed)
  categoryPath?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}
