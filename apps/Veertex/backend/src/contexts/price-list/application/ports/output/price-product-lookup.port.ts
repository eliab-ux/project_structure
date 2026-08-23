export const PRICE_PRODUCT_LOOKUP = Symbol('PRICE_PRODUCT_LOOKUP');

/** O que a resolução de preço precisa do produto: nome (mensagem) e o preço base (fallback). */
export interface PriceProductInfo {
  id: string;
  name: string;
  basePrice: number | null;
  active: boolean;
}

export interface PriceProductLookupPort {
  findById(productId: string): Promise<PriceProductInfo | null>;
}
