/**
 * Tipos do Produto — §3.5 do CORE.
 *
 * Espelham o `ProductDto` do backend. **Nenhuma lista de valores é declarada aqui**: unidades,
 * origens, tipos e condições vêm de `GET /products/field-catalog`, porque é o servidor que as
 * valida. Uma cópia no frontend divergiria na primeira sigla nova, e o sintoma seria a tela oferecer
 * uma opção que a API recusa.
 */

export type ProductFormat = 'simple' | 'bundle' | 'variant';
export type ProductKind = 'product' | 'service';
export type ProductCondition = 'new' | 'used';

/** A finalidade avaliada pelo widget de completude. */
export type ProductPurposeCode = 'sale' | 'freight' | 'fiscal';

export interface ProductPurposeStatus {
  purpose: ProductPurposeCode;
  /** Fala do CADASTRO ("Campos fiscais preenchidos"), nunca do sistema ("pronto para emitir"). */
  label: string;
  complete: boolean;
  missing: string[];
  /** Presente quando o módulo que executaria a finalidade não está ativo na conta. */
  pendenciaDeModulo: { code: string; message: string } | null;
}

export interface ProductSupplier {
  contactId: string;
  contactName: string | null;
  supplierDescription: string | null;
  supplierSku: string | null;
  cost: number | null;
  isDefault: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  format: ProductFormat;
  kind: ProductKind;
  unit: string;
  condition: ProductCondition;
  basePrice: number | null;
  brand: string | null;
  /** Caminho em texto. A árvore de categorias não existe nesta fatia. */
  categoryPath: string | null;
  tags: string[];
  ownProduction: boolean;
  shelfLifeDays: number | null;
  barcode: string | null;
  dun14: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  externalUrl: string | null;
  videoUrl: string | null;
  netWeightKg: number | null;
  grossWeightKg: number | null;
  widthCm: number | null;
  heightCm: number | null;
  lengthCm: number | null;
  itemsPerBox: number | null;
  minimumQuantity: number | null;
  maximumQuantity: number | null;
  location: string | null;
  origin: string | null;
  ncm: string | null;
  cest: string | null;
  itemType: string | null;
  approximateTaxPercent: number | null;
  taxGroup: string | null;
  taxableBarcode: string | null;
  suppliers: ProductSupplier[];
  purposes: ProductPurposeStatus[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFieldDefinition {
  field: string;
  label: string;
  group: 'header' | 'characteristics' | 'measures' | 'stock' | 'suppliers' | 'tax';
  rule: 'base' | 'optional';
  /** Valor efetivo (catálogo + `field_config` da conta), não o default cru. */
  visible: boolean;
  required: boolean;
  /** Ordem preferida pela conta; `null` = ordem do catálogo. */
  order?: number | null;
  /** Obrigatório por regra de domínio — a config não consegue ocultá-lo nem torná-lo opcional. */
  mandatoryByDomain?: boolean;
  /** Texto de apoio abaixo do campo — é por aqui que chega o aviso de módulo ausente. */
  hint?: string;
}

/** O que `GET /products/field-catalog` devolve: o catálogo e as listas fechadas do servidor. */
export interface ProductCatalog {
  fields: ProductFieldDefinition[];
  units: string[];
  origins: { code: string; label: string }[];
  kinds: { code: string; label: string }[];
  conditions: { code: string; label: string }[];
  /** Só os formatos que o servidor CRIA. A tela não oferece kit nem variação porque a API recusa. */
  creatableFormats: string[];
}

export interface ProductSupplierPayload {
  contactId: string;
  supplierDescription?: string | null;
  supplierSku?: string | null;
  cost?: number | null;
  isDefault?: boolean;
}

export interface CreateProductPayload {
  name: string;
  unit: string;
  sku?: string | null;
  kind?: string;
  condition?: string;
  basePrice?: number | null;
  brand?: string | null;
  categoryPath?: string | null;
  tags?: string[];
  barcode?: string | null;
  shortDescription?: string | null;
  netWeightKg?: number | null;
  grossWeightKg?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  lengthCm?: number | null;
  minimumQuantity?: number | null;
  maximumQuantity?: number | null;
  location?: string | null;
  origin?: string | null;
  ncm?: string | null;
  cest?: string | null;
  taxGroup?: string | null;
  suppliers?: ProductSupplierPayload[];
}

/** Edição: campo ausente = "não mexa"; campo `null` = "apague". */
export type UpdateProductPayload = Partial<CreateProductPayload> & { active?: boolean };
