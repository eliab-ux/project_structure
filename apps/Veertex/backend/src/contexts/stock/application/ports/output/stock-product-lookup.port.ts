export const STOCK_PRODUCT_LOOKUP = Symbol('STOCK_PRODUCT_LOOKUP');

/** O que o EST precisa do produto: existir, e os parâmetros de mínimo/máximo (§3.5 do CORE). */
export interface StockProductInfo {
  id: string;
  name: string;
  minimumQuantity: number | null;
  maximumQuantity: number | null;
  active: boolean;
}

export interface StockProductLookupPort {
  findById(productId: string): Promise<StockProductInfo | null>;
}
