import { randomUUID } from 'node:crypto';

/** Arredonda para 2 casas — mesma abordagem monetária do resto do sistema (number + toFixed no ORM). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Um item do pedido — uma linha de produto simples.
 *
 * ⚠️ **Kit não é modelado aqui no V1.** O §3.4 do 02 decidiu (c) "registra os dois" (kit pai +
 * componentes filhos), mas isso depende do EST (baixa dos componentes) e do `bundle` do Produto, que
 * está fora. A estrutura pai/filho entra junto com o EST; forçar um `parentItemId` inerte agora seria
 * a coluna que não aplica nada. Por ora, todo item é uma linha de produto `simple`.
 *
 * Desconto por item (§3.5): `discountValue` tem precedência sobre `discountPercent` quando ambos
 * vierem — uma só semântica evita dois números brigando pela mesma linha.
 */
export class OrderItem {
  private constructor(
    private readonly _id: string,
    private readonly _productId: string,
    private _description: string,
    private _quantity: number,
    private _unitPrice: number,
    private _discountPercent: number,
    private _discountValue: number,
  ) {}

  static create(params: {
    id?: string;
    productId: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number | null;
    discountValue?: number | null;
  }): OrderItem {
    return new OrderItem(
      params.id ?? randomUUID(),
      params.productId,
      params.description.trim(),
      params.quantity,
      round2(params.unitPrice),
      Math.max(0, Math.min(100, params.discountPercent ?? 0)),
      Math.max(0, round2(params.discountValue ?? 0)),
    );
  }

  get id(): string {
    return this._id;
  }
  get productId(): string {
    return this._productId;
  }
  get description(): string {
    return this._description;
  }
  get quantity(): number {
    return this._quantity;
  }
  get unitPrice(): number {
    return this._unitPrice;
  }
  get discountPercent(): number {
    return this._discountPercent;
  }
  get discountValue(): number {
    return this._discountValue;
  }

  /** Bruto da linha, antes do desconto. */
  get grossTotal(): number {
    return round2(this._quantity * this._unitPrice);
  }

  /** Desconto efetivo: valor tem precedência sobre percentual. */
  get effectiveDiscount(): number {
    const raw =
      this._discountValue > 0
        ? this._discountValue
        : (this.grossTotal * this._discountPercent) / 100;
    return round2(Math.min(raw, this.grossTotal));
  }

  get netTotal(): number {
    return round2(this.grossTotal - this.effectiveDiscount);
  }

  get hasDiscount(): boolean {
    return this.effectiveDiscount > 0;
  }
}
