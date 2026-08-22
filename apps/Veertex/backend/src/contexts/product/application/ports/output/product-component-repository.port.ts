export const PRODUCT_COMPONENT_REPOSITORY = Symbol('PRODUCT_COMPONENT_REPOSITORY');

export interface ProductComponentRow {
  componentProductId: string;
  quantity: number;
}

export interface ProductComponentRepositoryPort {
  /** A composição de um kit (bundle). Vazia se não for kit ou não tiver componentes. */
  findByParent(parentProductId: string): Promise<ProductComponentRow[]>;

  /** Substitui a composição do kit (soft-delete das antigas + insere as novas). */
  replaceForParent(
    accountId: string,
    parentProductId: string,
    components: readonly ProductComponentRow[],
  ): Promise<void>;
}
