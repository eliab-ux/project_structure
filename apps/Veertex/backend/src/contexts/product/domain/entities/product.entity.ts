import { AggregateRoot } from '@gitspread/domain-primitives';
import { ProductId } from '../value-objects/product-id.vo';
import {
  CommercialUnit,
  parseCommercialUnit,
  parseProductCondition,
  parseProductFormat,
  parseProductKind,
  parseProductOrigin,
  ProductCondition,
  ProductFormat,
  ProductKind,
  ProductOrigin,
} from '../product-types';
import {
  DuplicateDefaultSupplierException,
  DuplicateProductSupplierException,
  InvalidProductMeasureException,
  InvalidProductNameException,
  InvalidProductPriceException,
  InvalidProductStockParamsException,
} from '../exceptions/product-exceptions';

/**
 * Medidas físicas — o que a cotação de frete exige (§3.5).
 *
 * Todas nulas por padrão, e nulo aqui é dado ausente, não zero: um produto com peso 0 passaria por
 * "medido" numa cotação e produziria frete errado. É a razão de o widget de completude olhar
 * ausência, não valor.
 */
export interface ProductMeasures {
  /** Peso líquido em quilogramas. */
  netWeightKg: number | null;
  /** Peso bruto em quilogramas — é o que o transportador cobra. */
  grossWeightKg: number | null;
  widthCm: number | null;
  heightCm: number | null;
  lengthCm: number | null;
  /** Itens por caixa — §3.5. Junto com o DUN-14, descreve a embalagem de despacho. */
  itemsPerBox: number | null;
}

/**
 * Parâmetros de estoque — **parâmetro é do produto; SALDO é do EST** (§3.5).
 *
 * Mínimo, máximo e localização física descrevem COMO este item deve ser estocado, e essa decisão é
 * de quem cadastra o produto. Quantidade em mão é outra coisa, vive no módulo de Estoque, e não
 * existe nesta fatia — nenhuma coluna de saldo foi criada aqui, para ninguém supor que há.
 */
export interface ProductStockParams {
  minimumQuantity: number | null;
  maximumQuantity: number | null;
  /** Prateleira, corredor, gaveta — texto livre porque cada depósito nomeia do seu jeito. */
  location: string | null;
}

/**
 * DADOS FISCAIS DO PRODUTO — e só o que é do produto.
 *
 * A separação foi definida por Eliab em 19/08/2026, e o §3.5 é explícito sobre o limite:
 *
 * > *O grosso da regra fiscal vem da NATUREZA DE OPERAÇÃO + grupo (FIS); o produto complementa.*
 * > ***CFOP NÃO é campo de configuração global** (erro do Nexo a não repetir): deriva de natureza de
 * > operação × contexto.*
 *
 * Então aqui há **origem, NCM, CEST, tipo do item, % tributos (IBPT) e o rótulo do grupo fiscal** —
 * atributos da mercadoria, verdadeiros em qualquer operação. **Não há CFOP**, e não há a tabela de
 * herança do grupo: o grupo entra como identificador, e o que ele FAZ é do FIS.
 *
 * `taxGroup` é texto e não FK: a tabela de grupos é do FIS. FK para tabela inexistente é pior que
 * ausência — foi o mesmo motivo de a tabela de preço ter ficado fora do Contato.
 */
export interface ProductTaxData {
  origin: ProductOrigin | null;
  /** Nomenclatura Comum do Mercosul — 8 dígitos. */
  ncm: string | null;
  /** Código Especificador da Substituição Tributária — 7 dígitos, quando houver ST. */
  cest: string | null;
  /** Tipo do item para o Bloco K / SPED (mercadoria para revenda, matéria-prima, etc.). */
  itemType: string | null;
  /** % aproximado de tributos (IBPT) — o número que a lei da transparência manda exibir. */
  approximateTaxPercent: number | null;
  /** Rótulo do grupo de herança fiscal. O que o grupo FAZ é do FIS. */
  taxGroup: string | null;
  /** GTIN tributável (a unidade tributável, quando difere da comercial). */
  taxableBarcode: string | null;
}

/** Um fornecedor do produto — §3.5, "N por produto". */
export interface ProductSupplierEntry {
  /**
   * O contato fornecedor. **Referencia `contact`**, e o use case valida que ele tem o tipo
   * `supplier` — vínculo com contato que não é fornecedor é dado que ninguém consegue explicar
   * depois.
   */
  contactId: string;
  /** Como o fornecedor chama este item — quase nunca é o nome que a gente usa. */
  supplierDescription: string | null;
  /** O código do item no catálogo DELE, que é o que vai no pedido de compra. */
  supplierSku: string | null;
  /** Custo nesta fonte. Insumo da cotação de compras (CMP futuro) e da precificação. */
  cost: number | null;
  isDefault: boolean;
}

/**
 * PRODUTO — §3.5 do CORE.
 *
 * ## O que está aqui
 *
 * Cabeçalho (nome, SKU, formato, tipo, unidade, condição, preço base), características (marca,
 * categoria, tags, produção, validade, medidas, GTIN, descrições, links), parâmetros de estoque,
 * fornecedores e os dados fiscais **do produto**.
 *
 * ## O que está FORA, e cada um com o motivo
 *
 * | | Por que |
 * |---|---|
 * | **Kit (`bundle`)** | fora POR INTEIRO, nem a composição — sem EST, montar composição e vender não move estoque nenhum, e isso é comportamento errado silencioso, não campo inerte. Ver `product-types.ts` |
 * | **Variações (`variant`)** | §3.5: implementação antes do CAN completo, não agora |
 * | **Imagens** | MinIO não existe no ambiente (nenhuma variável, nenhuma dependência, nenhum serviço). Nem a tabela foi criada: guardar chave de objeto que nada produz sugere um recurso que não há |
 * | **CFOP** | §3.5, explícito. Deriva de natureza de operação × contexto — é do FIS |
 * | **Herança do grupo fiscal** | o grupo é rótulo aqui; a herança é regra do FIS |
 * | **Saldo e custo médio** | do EST. O §3.5 diz que o custo médio é "exibido aqui somente leitura" — não há o que exibir sem o módulo |
 * | **Tabela de preço** | preço base só. Tabela de preço exige o módulo de preços, e o Contato já a recusou pelo mesmo motivo |
 * | **Categoria em árvore** | texto por enquanto — ver a nota abaixo |
 *
 * ## `categoryPath` — texto PROVISÓRIO, e o nome foi escolhido pensando na migração
 *
 * Decisão de Eliab, 19/08/2026: texto simples nesta fatia, *"mas registre como provisório e escolha
 * o nome da coluna pensando na migração para árvore. É o campo que mais vira árvore de verdade em
 * ERP."*
 *
 * Daí `category_path`, e não `category`:
 *
 *  - o valor é um **caminho** (`"Ferramentas > Manuais > Chaves"`), que é exatamente a forma que
 *    sobrevive à migração: cada caminho distinto vira uma cadeia de nós, e o path continua
 *    verdadeiro como caminho materializado;
 *  - quando a árvore existir, a coluna nova será `category_id`. **`category_path` não colide com
 *    ela** — as duas coexistem durante o backfill, e a antiga pode ficar como cache de exibição em
 *    vez de ser jogada fora. Se a coluna se chamasse `category`, ou haveria colisão de nome ou
 *    sobraria um `category` que ninguém sabe se é o id ou o texto;
 *  - o separador ` > ` é convenção de exibição, não formato validado. Validar hierarquia sem a
 *    árvore seria inventar a árvore no lugar errado.
 */
export class Product extends AggregateRoot {
  private constructor(
    private readonly _id: ProductId,
    private readonly _accountId: string,
    private _name: string,
    private _sku: string | null,
    private readonly _format: ProductFormat,
    private _kind: ProductKind,
    private _unit: CommercialUnit,
    private _condition: ProductCondition,
    private _basePrice: number | null,
    private _brand: string | null,
    private _categoryPath: string | null,
    private _tags: string[],
    private _ownProduction: boolean,
    private _shelfLifeDays: number | null,
    private _barcode: string | null,
    private _dun14: string | null,
    private _shortDescription: string | null,
    private _longDescription: string | null,
    private _externalUrl: string | null,
    private _videoUrl: string | null,
    private _measures: ProductMeasures,
    private _stockParams: ProductStockParams,
    private _tax: ProductTaxData,
    private _suppliers: ProductSupplierEntry[],
    private _active: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    name: string;
    sku?: string | null;
    format?: string | null;
    kind?: string | null;
    unit: string;
    condition?: string | null;
    basePrice?: number | null;
    brand?: string | null;
    categoryPath?: string | null;
    tags?: readonly string[];
    ownProduction?: boolean;
    shelfLifeDays?: number | null;
    barcode?: string | null;
    dun14?: string | null;
    shortDescription?: string | null;
    longDescription?: string | null;
    externalUrl?: string | null;
    videoUrl?: string | null;
    measures?: Partial<ProductMeasures>;
    stockParams?: Partial<ProductStockParams>;
    tax?: Partial<Omit<ProductTaxData, 'origin'>> & { origin?: string | null };
    suppliers?: readonly Partial<ProductSupplierEntry>[];
  }): Product {
    return new Product(
      ProductId.generate(),
      params.accountId,
      Product.requireName(params.name),
      trimToNull(params.sku),
      // `parseProductFormat` RECUSA bundle e variant — é o ponto único onde isso é decidido.
      parseProductFormat(params.format ?? 'simple'),
      parseProductKind(params.kind ?? 'product'),
      parseCommercialUnit(params.unit),
      parseProductCondition(params.condition ?? 'new'),
      Product.parseMoney(params.basePrice ?? null, 'Preço de venda'),
      trimToNull(params.brand),
      trimToNull(params.categoryPath),
      normalizeTags(params.tags),
      params.ownProduction ?? false,
      Product.parsePositiveInt(params.shelfLifeDays ?? null, 'Validade em dias'),
      trimToNull(params.barcode),
      trimToNull(params.dun14),
      trimToNull(params.shortDescription),
      trimToNull(params.longDescription),
      trimToNull(params.externalUrl),
      trimToNull(params.videoUrl),
      normalizeMeasures(params.measures),
      normalizeStockParams(params.stockParams),
      normalizeTax(params.tax),
      normalizeSuppliers(params.suppliers),
      true,
      new Date(),
      new Date(),
    );
  }

  /** Reconstrução a partir da persistência — sem revalidar o que já foi validado na entrada. */
  static restore(params: {
    id: string;
    accountId: string;
    name: string;
    sku: string | null;
    format: ProductFormat;
    kind: ProductKind;
    unit: CommercialUnit;
    condition: ProductCondition;
    basePrice: number | null;
    brand: string | null;
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
    measures: ProductMeasures;
    stockParams: ProductStockParams;
    tax: ProductTaxData;
    suppliers: ProductSupplierEntry[];
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Product {
    return new Product(
      ProductId.from(params.id),
      params.accountId,
      params.name,
      params.sku,
      params.format,
      params.kind,
      params.unit,
      params.condition,
      params.basePrice,
      params.brand,
      params.categoryPath,
      params.tags,
      params.ownProduction,
      params.shelfLifeDays,
      params.barcode,
      params.dun14,
      params.shortDescription,
      params.longDescription,
      params.externalUrl,
      params.videoUrl,
      params.measures,
      params.stockParams,
      params.tax,
      params.suppliers,
      params.active,
      params.createdAt,
      params.updatedAt,
    );
  }

  update(params: {
    name?: string;
    sku?: string | null;
    kind?: string;
    unit?: string;
    condition?: string;
    basePrice?: number | null;
    brand?: string | null;
    categoryPath?: string | null;
    tags?: readonly string[];
    ownProduction?: boolean;
    shelfLifeDays?: number | null;
    barcode?: string | null;
    dun14?: string | null;
    shortDescription?: string | null;
    longDescription?: string | null;
    externalUrl?: string | null;
    videoUrl?: string | null;
    measures?: Partial<ProductMeasures>;
    stockParams?: Partial<ProductStockParams>;
    tax?: Partial<Omit<ProductTaxData, 'origin'>> & { origin?: string | null };
    suppliers?: readonly Partial<ProductSupplierEntry>[];
    active?: boolean;
  }): void {
    /*
     * O FORMATO NÃO É EDITÁVEL, e a ausência é deliberada.
     *
     * Trocar `simple` por `bundle` num produto que já tem histórico transformaria um item vendido
     * numa estrutura de composição — e como o kit não existe, o resultado seria um produto num
     * formato sem comportamento. Quando o EST chegar, a conversão será uma operação própria, com
     * regra sua, não um campo do formulário.
     */
    if (params.name !== undefined) {
      this._name = Product.requireName(params.name);
    }
    if (params.sku !== undefined) {
      this._sku = trimToNull(params.sku);
    }
    if (params.kind !== undefined) {
      this._kind = parseProductKind(params.kind);
    }
    if (params.unit !== undefined) {
      this._unit = parseCommercialUnit(params.unit);
    }
    if (params.condition !== undefined) {
      this._condition = parseProductCondition(params.condition);
    }
    if (params.basePrice !== undefined) {
      this._basePrice = Product.parseMoney(params.basePrice, 'Preço de venda');
    }
    if (params.brand !== undefined) {
      this._brand = trimToNull(params.brand);
    }
    if (params.categoryPath !== undefined) {
      this._categoryPath = trimToNull(params.categoryPath);
    }
    if (params.tags !== undefined) {
      this._tags = normalizeTags(params.tags);
    }
    if (params.ownProduction !== undefined) {
      this._ownProduction = params.ownProduction;
    }
    if (params.shelfLifeDays !== undefined) {
      this._shelfLifeDays = Product.parsePositiveInt(params.shelfLifeDays, 'Validade em dias');
    }
    if (params.barcode !== undefined) {
      this._barcode = trimToNull(params.barcode);
    }
    if (params.dun14 !== undefined) {
      this._dun14 = trimToNull(params.dun14);
    }
    if (params.shortDescription !== undefined) {
      this._shortDescription = trimToNull(params.shortDescription);
    }
    if (params.longDescription !== undefined) {
      this._longDescription = trimToNull(params.longDescription);
    }
    if (params.externalUrl !== undefined) {
      this._externalUrl = trimToNull(params.externalUrl);
    }
    if (params.videoUrl !== undefined) {
      this._videoUrl = trimToNull(params.videoUrl);
    }
    if (params.measures !== undefined) {
      this._measures = normalizeMeasures({ ...this._measures, ...params.measures });
    }
    if (params.stockParams !== undefined) {
      this._stockParams = normalizeStockParams({ ...this._stockParams, ...params.stockParams });
    }
    if (params.tax !== undefined) {
      this._tax = normalizeTax({
        ...this._tax,
        ...params.tax,
        origin: params.tax.origin ?? this._tax.origin,
      });
    }
    if (params.suppliers !== undefined) {
      this._suppliers = normalizeSuppliers(params.suppliers);
    }
    if (params.active !== undefined) {
      this._active = params.active;
    }
    this._updatedAt = new Date();
  }

  private static requireName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      throw new InvalidProductNameException('Nome do produto é obrigatório.');
    }
    if (trimmed.length > 200) {
      throw new InvalidProductNameException('Nome do produto excede 200 caracteres.');
    }
    return trimmed;
  }

  /** Dinheiro com duas casas — guardar 10,005 e exibir 10,01 faz a soma da tela não bater com a do banco. */
  private static parseMoney(value: number | null, label: string): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!Number.isFinite(value) || value < 0) {
      throw new InvalidProductPriceException(`${label} não pode ser negativo.`);
    }
    return Math.round(value * 100) / 100;
  }

  private static parsePositiveInt(value: number | null, label: string): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!Number.isInteger(value) || value <= 0) {
      throw new InvalidProductStockParamsException(`${label} deve ser um número inteiro positivo.`);
    }
    return value;
  }

  get id(): ProductId {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get name(): string {
    return this._name;
  }
  get sku(): string | null {
    return this._sku;
  }
  get format(): ProductFormat {
    return this._format;
  }
  get kind(): ProductKind {
    return this._kind;
  }
  get unit(): CommercialUnit {
    return this._unit;
  }
  get condition(): ProductCondition {
    return this._condition;
  }
  get basePrice(): number | null {
    return this._basePrice;
  }
  get brand(): string | null {
    return this._brand;
  }
  get categoryPath(): string | null {
    return this._categoryPath;
  }
  get tags(): readonly string[] {
    return this._tags;
  }
  get ownProduction(): boolean {
    return this._ownProduction;
  }
  get shelfLifeDays(): number | null {
    return this._shelfLifeDays;
  }
  get barcode(): string | null {
    return this._barcode;
  }
  get dun14(): string | null {
    return this._dun14;
  }
  get shortDescription(): string | null {
    return this._shortDescription;
  }
  get longDescription(): string | null {
    return this._longDescription;
  }
  get externalUrl(): string | null {
    return this._externalUrl;
  }
  get videoUrl(): string | null {
    return this._videoUrl;
  }
  get measures(): ProductMeasures {
    return this._measures;
  }
  get stockParams(): ProductStockParams {
    return this._stockParams;
  }
  get tax(): ProductTaxData {
    return this._tax;
  }
  get suppliers(): readonly ProductSupplierEntry[] {
    return this._suppliers;
  }
  get active(): boolean {
    return this._active;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Tags normalizadas: minúsculas, sem duplicata, ordenadas.
 *
 * "Promoção" e "promoção" são a mesma tag, e guardar as duas produziria dois filtros na tela para o
 * mesmo conjunto — sujeira que só aparece quando a lista de tags já está grande.
 */
function normalizeTags(tags?: readonly string[]): string[] {
  if (!tags) {
    return [];
  }
  const limpas = tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0);
  return [...new Set(limpas)].sort();
}

/** Medida negativa ou zero é dado errado, não "sem medida" — sem medida é `null`. */
function medida(value: number | null | undefined, label: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new InvalidProductMeasureException(`${label} deve ser maior que zero.`);
  }
  // Três casas: 0,125 kg é peso comum de item pequeno, e arredondar para 0,13 erraria o frete.
  return Math.round(value * 1000) / 1000;
}

function normalizeMeasures(partial?: Partial<ProductMeasures>): ProductMeasures {
  const bruto = medida(partial?.grossWeightKg, 'Peso bruto');
  const liquido = medida(partial?.netWeightKg, 'Peso líquido');

  /*
   * Bruto menor que líquido é impossível — a embalagem não tem massa negativa. Vale checar porque a
   * troca dos dois campos é o erro de digitação mais comum aqui, e o resultado é um frete cotado
   * para menos, que só aparece na fatura do transportador.
   */
  if (bruto !== null && liquido !== null && bruto < liquido) {
    throw new InvalidProductMeasureException(
      'Peso bruto não pode ser menor que o peso líquido — os campos podem estar trocados.',
    );
  }

  return {
    netWeightKg: liquido,
    grossWeightKg: bruto,
    widthCm: medida(partial?.widthCm, 'Largura'),
    heightCm: medida(partial?.heightCm, 'Altura'),
    lengthCm: medida(partial?.lengthCm, 'Comprimento'),
    itemsPerBox:
      partial?.itemsPerBox === null || partial?.itemsPerBox === undefined
        ? null
        : Number.isInteger(partial.itemsPerBox) && partial.itemsPerBox > 0
          ? partial.itemsPerBox
          : (() => {
              throw new InvalidProductMeasureException(
                'Itens por caixa deve ser um número inteiro positivo.',
              );
            })(),
  };
}

function normalizeStockParams(partial?: Partial<ProductStockParams>): ProductStockParams {
  const minimo = partial?.minimumQuantity ?? null;
  const maximo = partial?.maximumQuantity ?? null;

  for (const [valor, label] of [
    [minimo, 'Estoque mínimo'],
    [maximo, 'Estoque máximo'],
  ] as const) {
    if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
      throw new InvalidProductStockParamsException(`${label} não pode ser negativo.`);
    }
  }

  // Máximo abaixo do mínimo torna a faixa vazia: nenhuma quantidade satisfaria as duas regras, e o
  // alerta de reposição do EST nunca poderia ser resolvido.
  if (minimo !== null && maximo !== null && maximo < minimo) {
    throw new InvalidProductStockParamsException(
      'Estoque máximo não pode ser menor que o estoque mínimo.',
    );
  }

  return {
    minimumQuantity: minimo,
    maximumQuantity: maximo,
    location: trimToNull(partial?.location),
  };
}

function normalizeTax(
  partial?: Partial<Omit<ProductTaxData, 'origin'>> & { origin?: string | null },
): ProductTaxData {
  const ncm = onlyDigitsOrNull(partial?.ncm);
  if (ncm !== null && ncm.length !== 8) {
    throw new InvalidProductMeasureException('NCM deve ter 8 dígitos.');
  }
  const cest = onlyDigitsOrNull(partial?.cest);
  if (cest !== null && cest.length !== 7) {
    throw new InvalidProductMeasureException('CEST deve ter 7 dígitos.');
  }

  const percentual = partial?.approximateTaxPercent ?? null;
  if (percentual !== null && (!Number.isFinite(percentual) || percentual < 0 || percentual > 100)) {
    throw new InvalidProductMeasureException('% de tributos deve estar entre 0 e 100.');
  }

  return {
    origin: partial?.origin ? parseProductOrigin(partial.origin) : null,
    ncm,
    cest,
    itemType: trimToNull(partial?.itemType),
    approximateTaxPercent: percentual === null ? null : Math.round(percentual * 100) / 100,
    taxGroup: trimToNull(partial?.taxGroup),
    taxableBarcode: trimToNull(partial?.taxableBarcode),
  };
}

function onlyDigitsOrNull(value: string | null | undefined): string | null {
  const limpo = value?.replace(/\D/g, '');
  return limpo ? limpo : null;
}

/**
 * Fornecedores normalizados, com as duas regras do §3.5 e da decisão do Eliab.
 *
 * O `contactId` é validado no USE CASE (é ele que alcança o repositório de contatos para conferir o
 * tipo `supplier`) — aqui ficam as invariantes que não precisam de banco.
 */
function normalizeSuppliers(
  suppliers?: readonly Partial<ProductSupplierEntry>[],
): ProductSupplierEntry[] {
  if (!suppliers) {
    return [];
  }

  const entradas = suppliers
    .filter((entry) => Boolean(entry.contactId))
    .map((entry) => ({
      contactId: String(entry.contactId),
      supplierDescription: trimToNull(entry.supplierDescription),
      supplierSku: trimToNull(entry.supplierSku),
      cost:
        entry.cost === null || entry.cost === undefined
          ? null
          : Number.isFinite(entry.cost) && entry.cost >= 0
            ? Math.round(entry.cost * 100) / 100
            : (() => {
                throw new InvalidProductPriceException(
                  'Custo do fornecedor não pode ser negativo.',
                );
              })(),
      isDefault: entry.isDefault ?? false,
    }));

  const ids = new Set(entradas.map((entry) => entry.contactId));
  if (ids.size !== entradas.length) {
    throw new DuplicateProductSupplierException();
  }

  if (entradas.filter((entry) => entry.isDefault).length > 1) {
    throw new DuplicateDefaultSupplierException();
  }

  return entradas;
}
