export const ORDER_PRODUCT_LOOKUP = Symbol('ORDER_PRODUCT_LOOKUP');

/** O que o VND precisa de um produto para colocá-lo num pedido. */
export interface OrderProductInfo {
  id: string;
  name: string;
  /** Preço de venda base (§3.5 CORE). `null` = sem preço base; o item exige preço explícito. */
  basePrice: number | null;
  active: boolean;
}

/**
 * Lê os produtos de um pedido sem o VND depender do módulo de Produto — mesmo desenho dos demais
 * lookups. Escopado pelo tenant.
 */
export interface OrderProductLookupPort {
  findByIds(productIds: readonly string[]): Promise<Map<string, OrderProductInfo>>;
}
