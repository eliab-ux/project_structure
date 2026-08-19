/**
 * A forma de entrada compartilhada por criação e edição.
 *
 * Existe para que os dois use cases não descrevam 34 campos cada um — duas listas do mesmo conjunto
 * divergem na primeira alteração, e o campo esquecido em uma delas seria silenciosamente ignorado
 * naquele caminho.
 *
 * `format` está aqui **só na criação** (ver `CreateProductCommand`): a edição não troca o formato, e
 * o motivo está na entidade — converter um produto simples em kit sem o módulo de Estoque produziria
 * um item num formato sem comportamento.
 */
export interface ProductSupplierInput {
  contactId: string;
  supplierDescription?: string | null;
  supplierSku?: string | null;
  cost?: number | null;
  isDefault?: boolean;
}

export interface ProductInput {
  name: string;
  sku?: string | null;
  format?: string | null;
  kind?: string | null;
  unit: string;
  condition?: string | null;
  basePrice?: number | null;
  brand?: string | null;
  categoryPath?: string | null;
  tags?: string[];
  ownProduction?: boolean;
  shelfLifeDays?: number | null;
  barcode?: string | null;
  dun14?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  externalUrl?: string | null;
  videoUrl?: string | null;
  netWeightKg?: number | null;
  grossWeightKg?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  lengthCm?: number | null;
  itemsPerBox?: number | null;
  minimumQuantity?: number | null;
  maximumQuantity?: number | null;
  location?: string | null;
  origin?: string | null;
  ncm?: string | null;
  cest?: string | null;
  itemType?: string | null;
  approximateTaxPercent?: number | null;
  taxGroup?: string | null;
  taxableBarcode?: string | null;
  suppliers?: ProductSupplierInput[];
}

/**
 * Achata → aninha: a entrada HTTP é plana (um formulário), o domínio é agrupado (medidas, estoque,
 * tributação). A conversão vive AQUI e em nenhum outro lugar.
 *
 * Se cada use case fizesse a sua, um campo novo entraria em um caminho e não no outro — e o sintoma
 * seria "salva na criação e some na edição", que é o tipo de defeito que leva meia hora para
 * reproduzir e cinco minutos para corrigir.
 *
 * `undefined` é preservado de propósito: na EDIÇÃO, `undefined` significa "não mexa neste campo" e
 * `null` significa "apague". Trocar um pelo outro apagaria dado que ninguém pediu para apagar.
 */
export function paraDominio(input: Partial<ProductInput>) {
  return {
    name: input.name,
    sku: input.sku,
    kind: input.kind ?? undefined,
    unit: input.unit,
    condition: input.condition ?? undefined,
    basePrice: input.basePrice,
    brand: input.brand,
    categoryPath: input.categoryPath,
    tags: input.tags,
    ownProduction: input.ownProduction,
    shelfLifeDays: input.shelfLifeDays,
    barcode: input.barcode,
    dun14: input.dun14,
    shortDescription: input.shortDescription,
    longDescription: input.longDescription,
    externalUrl: input.externalUrl,
    videoUrl: input.videoUrl,
    measures: temAlgum(input, [
      'netWeightKg',
      'grossWeightKg',
      'widthCm',
      'heightCm',
      'lengthCm',
      'itemsPerBox',
    ])
      ? {
          netWeightKg: input.netWeightKg,
          grossWeightKg: input.grossWeightKg,
          widthCm: input.widthCm,
          heightCm: input.heightCm,
          lengthCm: input.lengthCm,
          itemsPerBox: input.itemsPerBox,
        }
      : undefined,
    stockParams: temAlgum(input, ['minimumQuantity', 'maximumQuantity', 'location'])
      ? {
          minimumQuantity: input.minimumQuantity,
          maximumQuantity: input.maximumQuantity,
          location: input.location,
        }
      : undefined,
    tax: temAlgum(input, [
      'origin',
      'ncm',
      'cest',
      'itemType',
      'approximateTaxPercent',
      'taxGroup',
      'taxableBarcode',
    ])
      ? {
          origin: input.origin,
          ncm: input.ncm,
          cest: input.cest,
          itemType: input.itemType,
          approximateTaxPercent: input.approximateTaxPercent,
          taxGroup: input.taxGroup,
          taxableBarcode: input.taxableBarcode,
        }
      : undefined,
    suppliers: input.suppliers,
  };
}

/**
 * O grupo aninhado só é enviado ao domínio se ALGUM campo dele veio na requisição.
 *
 * Sem esta checagem, editar só o nome mandaria `measures: { todos undefined }` — e o domínio, ao
 * receber o objeto, normalizaria tudo para `null`, **apagando as medidas** de quem só quis corrigir
 * uma letra. É a diferença entre "não mencionou" e "mandou vazio".
 */
function temAlgum(input: Partial<ProductInput>, campos: (keyof ProductInput)[]): boolean {
  return campos.some((campo) => input[campo] !== undefined);
}
