export const STOCK_PRODUCT_LOOKUP = Symbol('STOCK_PRODUCT_LOOKUP');

/** O que o EST precisa do produto: existir, mín/máx (§3.5) e, se for kit, a composição (§2.5). */
export interface StockProductInfo {
  id: string;
  name: string;
  minimumQuantity: number | null;
  maximumQuantity: number | null;
  active: boolean;
  /** Kit (bundle): o disponível é DERIVADO dos componentes (§2.5) — o kit não tem saldo próprio. */
  isBundle: boolean;
  components: { productId: string; quantity: number }[];
}

export interface StockProductLookupPort {
  findById(productId: string): Promise<StockProductInfo | null>;
}
