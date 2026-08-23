import { Product } from '../../domain/entities/product.entity';
import {
  CommercialUnit,
  ProductCondition,
  ProductFormat,
  ProductKind,
  ProductOrigin,
} from '../../domain/product-types';
import {
  avaliarCompletude,
  finalidadeSeAplica,
  ProductPurposeStatus,
} from '../../domain/product-completeness';

export interface ProductSupplierDto {
  contactId: string;
  /** Preenchido na leitura, para a tela não precisar buscar cada contato. */
  contactName: string | null;
  supplierDescription: string | null;
  supplierSku: string | null;
  cost: number | null;
  isDefault: boolean;
}

/**
 * O produto como o cliente HTTP o vê.
 *
 * Mapeamento explícito, campo a campo (`CLAUDE.md`): devolver a entidade exporia a forma interna e
 * amarraria o contrato a ela.
 *
 * **`purposes` viaja junto**, e não é enfeite: é o widget de completude do §3.5. Ele vem do servidor
 * porque a regra de "o que falta para esta finalidade" é de domínio, e porque a pendência de módulo
 * (`pendenciaDeModulo`) depende dos módulos ativos da conta — que o servidor conhece pelo token e a
 * tela não deveria recalcular.
 */
export class ProductDto {
  id!: string;
  name!: string;
  sku!: string | null;
  format!: ProductFormat;
  /** Composição do kit (§2.5 do 03) — presente só no GET por id de um `bundle`. */
  components?: { componentProductId: string; quantity: number }[];
  kind!: ProductKind;
  unit!: CommercialUnit;
  condition!: ProductCondition;
  basePrice!: number | null;
  brand!: string | null;
  /** Caminho em texto. A árvore de categorias não existe — ver a entidade. */
  categoryPath!: string | null;
  tags!: string[];
  ownProduction!: boolean;
  shelfLifeDays!: number | null;
  barcode!: string | null;
  dun14!: string | null;
  shortDescription!: string | null;
  longDescription!: string | null;
  externalUrl!: string | null;
  videoUrl!: string | null;
  netWeightKg!: number | null;
  grossWeightKg!: number | null;
  widthCm!: number | null;
  heightCm!: number | null;
  lengthCm!: number | null;
  itemsPerBox!: number | null;
  minimumQuantity!: number | null;
  maximumQuantity!: number | null;
  location!: string | null;
  origin!: ProductOrigin | null;
  ncm!: string | null;
  cest!: string | null;
  itemType!: string | null;
  approximateTaxPercent!: number | null;
  taxGroup!: string | null;
  taxableBarcode!: string | null;
  suppliers!: ProductSupplierDto[];
  /** Completude por finalidade (§3.5). Diz o que o CADASTRO tem, nunca o que o sistema faz. */
  purposes!: ProductPurposeStatus[];
  active!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  /**
   * @param activeModules módulos ativos da conta, do TOKEN — decidem se o aviso de módulo ausente
   *   aparece. Lista vazia significa "nenhum módulo além do CORE", que é o estado real hoje.
   * @param supplierNames nomes dos contatos fornecedores, quando o chamador os tiver
   */
  static fromDomain(
    product: Product,
    activeModules: readonly string[] = [],
    supplierNames: ReadonlyMap<string, string> = new Map(),
  ): ProductDto {
    const dto = new ProductDto();
    dto.id = product.id.value;
    dto.name = product.name;
    dto.sku = product.sku;
    dto.format = product.format;
    dto.kind = product.kind;
    dto.unit = product.unit;
    dto.condition = product.condition;
    dto.basePrice = product.basePrice;
    dto.brand = product.brand;
    dto.categoryPath = product.categoryPath;
    dto.tags = [...product.tags];
    dto.ownProduction = product.ownProduction;
    dto.shelfLifeDays = product.shelfLifeDays;
    dto.barcode = product.barcode;
    dto.dun14 = product.dun14;
    dto.shortDescription = product.shortDescription;
    dto.longDescription = product.longDescription;
    dto.externalUrl = product.externalUrl;
    dto.videoUrl = product.videoUrl;
    dto.netWeightKg = product.measures.netWeightKg;
    dto.grossWeightKg = product.measures.grossWeightKg;
    dto.widthCm = product.measures.widthCm;
    dto.heightCm = product.measures.heightCm;
    dto.lengthCm = product.measures.lengthCm;
    dto.itemsPerBox = product.measures.itemsPerBox;
    dto.minimumQuantity = product.stockParams.minimumQuantity;
    dto.maximumQuantity = product.stockParams.maximumQuantity;
    dto.location = product.stockParams.location;
    dto.origin = product.tax.origin;
    dto.ncm = product.tax.ncm;
    dto.cest = product.tax.cest;
    dto.itemType = product.tax.itemType;
    dto.approximateTaxPercent = product.tax.approximateTaxPercent;
    dto.taxGroup = product.tax.taxGroup;
    dto.taxableBarcode = product.tax.taxableBarcode;
    dto.suppliers = product.suppliers.map((entry) => ({
      contactId: entry.contactId,
      contactName: supplierNames.get(entry.contactId) ?? null,
      supplierDescription: entry.supplierDescription,
      supplierSku: entry.supplierSku,
      cost: entry.cost,
      isDefault: entry.isDefault,
    }));
    // Serviço não tem peso: a finalidade de frete é OMITIDA em vez de aparecer eternamente
    // incompleta — indicador que nunca fica verde é indicador que se aprende a ignorar.
    dto.purposes = avaliarCompletude(product, activeModules).filter((status) =>
      finalidadeSeAplica(product, status.purpose),
    );
    dto.active = product.active;
    dto.createdAt = product.createdAt;
    dto.updatedAt = product.updatedAt;
    return dto;
  }
}
