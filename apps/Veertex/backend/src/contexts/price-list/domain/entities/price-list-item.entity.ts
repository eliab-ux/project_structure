import { randomUUID } from 'node:crypto';

/** Arredonda a 2 casas (preço em reais). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Item de uma tabela de preço (§3.2 do 02A): produto, preço e o **degrau por quantidade**
 * (`minQuantity`) — o preço vale a partir daquela quantidade (atacado). Um produto pode ter vários
 * degraus na mesma tabela (ex.: 1un = 10,00; a partir de 12un = 8,50).
 */
export class PriceListItem {
  private constructor(
    private readonly _id: string,
    private readonly _productId: string,
    private readonly _price: number,
    private readonly _minQuantity: number,
  ) {}

  static create(params: {
    id?: string;
    productId: string;
    price: number;
    minQuantity?: number | null;
  }): PriceListItem {
    return new PriceListItem(
      params.id ?? randomUUID(),
      params.productId,
      round2(Math.max(0, params.price)),
      Math.max(1, Math.trunc(params.minQuantity ?? 1)),
    );
  }

  get id(): string {
    return this._id;
  }
  get productId(): string {
    return this._productId;
  }
  get price(): number {
    return this._price;
  }
  get minQuantity(): number {
    return this._minQuantity;
  }
}
