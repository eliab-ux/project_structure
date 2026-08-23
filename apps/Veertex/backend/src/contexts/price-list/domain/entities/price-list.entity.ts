import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { PriceListItem } from './price-list-item.entity';

/**
 * Tabela de preço (§3.2 do 02A) — entidade do VND. Multi-canal com **degrau por quantidade** nos
 * itens. Vínculos possíveis (a resolução por prioridade os usa): `contactId` (tabela do cliente) e
 * `salesRepId` (tabela do vendedor). Canal e PDV são rungs futuros (CAN/PDV) — reservados, não
 * modelados aqui até os módulos donos existirem.
 *
 * O ROT **consome** (a tabela do representante), restrito pela Regra Comercial; não é dono (04).
 */
export class PriceList extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private _name: string,
    private _active: boolean,
    private _contactId: string | null,
    private _salesRepId: string | null,
    private _items: PriceListItem[],
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    name: string;
    contactId?: string | null;
    salesRepId?: string | null;
    items?: PriceListItem[];
  }): PriceList {
    return new PriceList(
      randomUUID(),
      params.accountId,
      params.name.trim(),
      true,
      params.contactId ?? null,
      params.salesRepId ?? null,
      params.items ?? [],
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    name: string;
    active: boolean;
    contactId: string | null;
    salesRepId: string | null;
    items: PriceListItem[];
    createdAt: Date;
  }): PriceList {
    return new PriceList(
      params.id,
      params.accountId,
      params.name,
      params.active,
      params.contactId,
      params.salesRepId,
      params.items,
      params.createdAt,
    );
  }

  editHeader(params: {
    name?: string;
    active?: boolean;
    contactId?: string | null;
    salesRepId?: string | null;
  }): void {
    if (params.name !== undefined) this._name = params.name.trim();
    if (params.active !== undefined) this._active = params.active;
    if (params.contactId !== undefined) this._contactId = params.contactId;
    if (params.salesRepId !== undefined) this._salesRepId = params.salesRepId;
  }

  replaceItems(items: PriceListItem[]): void {
    this._items = items;
  }

  /**
   * O preço do produto para uma quantidade: o item do MAIOR degrau (`minQuantity`) que ainda cabe na
   * quantidade pedida. Sem item aplicável → `null` (a resolução cai para a próxima tabela ou a base).
   */
  priceFor(productId: string, quantity: number): number | null {
    const applicable = this._items
      .filter((item) => item.productId === productId && item.minQuantity <= quantity)
      .sort((a, b) => b.minQuantity - a.minQuantity);
    return applicable.length > 0 ? applicable[0].price : null;
  }

  get id(): string {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get name(): string {
    return this._name;
  }
  get active(): boolean {
    return this._active;
  }
  get contactId(): string | null {
    return this._contactId;
  }
  get salesRepId(): string | null {
    return this._salesRepId;
  }
  get items(): readonly PriceListItem[] {
    return this._items;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
