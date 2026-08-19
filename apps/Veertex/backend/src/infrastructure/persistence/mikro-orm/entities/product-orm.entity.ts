import { Collection, Entity, Index, OneToMany, Property, Unique } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';
import { ProductSupplierOrmEntity } from './product-supplier-orm.entity';

/**
 * O produto — §3.5 do CORE.
 *
 * ## Unicidade por conta, nunca global
 *
 * `(account_id, sku)` e `(account_id, barcode)`: contas diferentes podem usar o mesmo SKU, e vão —
 * "CX-100" é o código de alguém em toda loja do país. Índice global recusaria o cadastro de um
 * cliente porque outro chegou primeiro, o que é a pior forma de multi-tenant vazar.
 *
 * ## ⚠️ Colunas que NÃO existem, e cada ausência é decisão
 *
 * | Ausente | Por que |
 * |---|---|
 * | `stock_quantity`, `average_cost` | saldo e custo médio são do EST. Coluna aqui seria número que ninguém atualiza, e alguém somaria |
 * | qualquer coisa de KIT (composição, componentes) | o kit ficou fora POR INTEIRO: sem o EST, montar composição e vender não move estoque, e isso é comportamento errado silencioso |
 * | `image_object_key`, tabela `product_image` | MinIO não existe no ambiente. Chave de objeto que nada produz sugere recurso que não há |
 * | `cfop` | §3.5, explícito: deriva de natureza de operação × contexto. É do FIS |
 * | `category_id` | a árvore de categorias não existe. Ver `categoryPath` |
 *
 * A regra por trás das cinco é a mesma que manteve a carteirização fora do Contato: **coluna
 * existindo sem o comportamento é pior que coluna ausente**, porque alguém depois supõe que ela faz
 * algo.
 */
@Entity({ tableName: 'products' })
@Unique({ properties: ['accountId', 'sku'] })
@Unique({ properties: ['accountId', 'barcode'] })
export class ProductOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ length: 200 })
  name!: string;

  /** Manual nesta fatia — sequencial exige contador por tenant, que é design próprio. */
  @Index()
  @Property({ length: 60, nullable: true })
  sku!: string | null;

  /**
   * `simple | bundle | variant`. Hoje **só `simple` é aceito** — o enum é do §3.5 ("deixar enum
   * aberto"), e a recusa dos outros dois vive no domínio, não no banco: mensagem de constraint não
   * explica que kit depende do módulo de Estoque.
   */
  @Property({ length: 20, default: 'simple' })
  format = 'simple';

  @Property({ length: 20, default: 'product' })
  kind = 'product';

  /** Sigla da unidade comercial, sempre em maiúscula (o domínio normaliza). */
  @Property({ length: 6 })
  unit!: string;

  @Property({ length: 10, default: 'new' })
  condition = 'new';

  /** `decimal` e não `float`: dinheiro em ponto flutuante soma errado. */
  @Property({ type: 'decimal', precision: 14, scale: 2, nullable: true, fieldName: 'base_price' })
  basePrice!: string | null;

  @Index()
  @Property({ length: 100, nullable: true })
  brand!: string | null;

  /**
   * O caminho da categoria em TEXTO — provisório, e o nome antecipa a migração.
   *
   * Quando a árvore existir, entra `category_id` ao lado; as duas coexistem durante o backfill e esta
   * pode ficar como cache de exibição. Se a coluna se chamasse `category`, sobraria um nome ambíguo
   * (é o id ou o texto?) exatamente no momento em que clareza importa.
   */
  @Index()
  @Property({ length: 300, nullable: true, fieldName: 'category_path' })
  categoryPath!: string | null;

  /** `text[]` com GIN, mesma escolha dos tipos do contato: conjunto pequeno, sempre lido junto. */
  @Property({ type: 'text[]', default: '{}' })
  tags: string[] = [];

  @Property({ type: 'boolean', default: false, fieldName: 'own_production' })
  ownProduction = false;

  @Property({ type: 'int', nullable: true, fieldName: 'shelf_life_days' })
  shelfLifeDays!: number | null;

  /** GTIN/EAN — dígitos, mas guardado como texto: zero à esquerda é significativo. */
  @Index()
  @Property({ length: 20, nullable: true })
  barcode!: string | null;

  @Property({ length: 20, nullable: true })
  dun14!: string | null;

  @Property({ length: 500, nullable: true, fieldName: 'short_description' })
  shortDescription!: string | null;

  @Property({ type: 'text', nullable: true, fieldName: 'long_description' })
  longDescription!: string | null;

  @Property({ length: 500, nullable: true, fieldName: 'external_url' })
  externalUrl!: string | null;

  @Property({ length: 500, nullable: true, fieldName: 'video_url' })
  videoUrl!: string | null;

  // ── Medidas: o único bloco cuja finalidade é verificável hoje (cotação de frete, §3.5) ────────
  // `decimal` com 3 casas: 0,125 kg é peso comum de item pequeno, e arredondar erraria o frete.
  @Property({
    type: 'decimal',
    precision: 12,
    scale: 3,
    nullable: true,
    fieldName: 'net_weight_kg',
  })
  netWeightKg!: string | null;

  @Property({
    type: 'decimal',
    precision: 12,
    scale: 3,
    nullable: true,
    fieldName: 'gross_weight_kg',
  })
  grossWeightKg!: string | null;

  @Property({ type: 'decimal', precision: 12, scale: 3, nullable: true, fieldName: 'width_cm' })
  widthCm!: string | null;

  @Property({ type: 'decimal', precision: 12, scale: 3, nullable: true, fieldName: 'height_cm' })
  heightCm!: string | null;

  @Property({ type: 'decimal', precision: 12, scale: 3, nullable: true, fieldName: 'length_cm' })
  lengthCm!: string | null;

  @Property({ type: 'int', nullable: true, fieldName: 'items_per_box' })
  itemsPerBox!: number | null;

  // ── Parâmetros de estoque: PARÂMETRO é do produto, SALDO é do EST ─────────────────────────────
  @Property({
    type: 'decimal',
    precision: 14,
    scale: 3,
    nullable: true,
    fieldName: 'minimum_quantity',
  })
  minimumQuantity!: string | null;

  @Property({
    type: 'decimal',
    precision: 14,
    scale: 3,
    nullable: true,
    fieldName: 'maximum_quantity',
  })
  maximumQuantity!: string | null;

  @Property({ length: 100, nullable: true, fieldName: 'stock_location' })
  stockLocation!: string | null;

  // ── Tributação: só o que é DADO DO PRODUTO. Sem CFOP, sem herança de grupo ────────────────────
  /** Código de origem da NF-e (0 a 8) — este é tabela fechada de verdade. */
  @Property({ length: 1, nullable: true, fieldName: 'tax_origin' })
  taxOrigin!: string | null;

  @Index()
  @Property({ length: 8, nullable: true })
  ncm!: string | null;

  @Property({ length: 7, nullable: true })
  cest!: string | null;

  @Property({ length: 60, nullable: true, fieldName: 'item_type' })
  itemType!: string | null;

  @Property({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    fieldName: 'approximate_tax_percent',
  })
  approximateTaxPercent!: string | null;

  /** Rótulo do grupo. A herança fiscal é do FIS — aqui é identificação, não regra. */
  @Property({ length: 100, nullable: true, fieldName: 'tax_group' })
  taxGroup!: string | null;

  @Property({ length: 20, nullable: true, fieldName: 'taxable_barcode' })
  taxableBarcode!: string | null;

  @Property({ type: 'boolean', default: true })
  active = true;

  @OneToMany(() => ProductSupplierOrmEntity, (supplier) => supplier.product)
  suppliers = new Collection<ProductSupplierOrmEntity>(this);
}
