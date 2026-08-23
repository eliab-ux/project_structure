import { AggregateRoot } from '@gitspread/domain-primitives';
import { OrderId } from '../value-objects/order-id.vo';
import { OrderItem, round2 } from './order-item.entity';
import { DEFAULT_DELIVERY_MODE, DeliveryMode, OrderOrigin } from '../order-origin';
import { canTransition, OrderStatus, STATUSES_REQUIRING_MODULES } from '../order-status';
import {
  EmptyOrderException,
  InvalidStatusTransitionException,
  InvoicingNotAvailableException,
} from '../exceptions/order-exceptions';

/**
 * O pedido de venda (VND, §3.2 do 02).
 *
 * Carrega a empresa (§2.6: pedido pertence a UMA empresa, numeração por empresa), o contato
 * (cliente), o vendedor (`salesRepId`, quem vendeu — base da comissão futura), a origem (§3.3), a
 * data de referência (§2.7, para "vendas do período") e o número por empresa.
 *
 * **A comissão NÃO é calculada aqui** — fica por último, esperando o Eliab definir o que são os
 * modelos A e B (§3.1 do 02, decisão pendente dele). O `salesRepId` já é guardado para quando o
 * cálculo entrar.
 *
 * A checagem de LIMITE DE CRÉDITO não mora na entidade (ela não conhece o contato) — mora no use
 * case de confirmação, que lê o limite pelo lookup e compara com `total`.
 */
export class Order extends AggregateRoot {
  private constructor(
    private readonly _id: OrderId,
    private readonly _accountId: string,
    private readonly _companyId: string,
    private readonly _contactId: string,
    private _salesRepId: string | null,
    private readonly _number: number,
    private _origin: OrderOrigin,
    private _deliveryMode: DeliveryMode,
    private _originDetail: string | null,
    private _status: OrderStatus,
    private _items: OrderItem[],
    private _discountPercent: number,
    private _discountValue: number,
    private _notes: string | null,
    private _referenceDate: Date,
    private _validUntil: Date | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    companyId: string;
    contactId: string;
    salesRepId?: string | null;
    number: number;
    origin: OrderOrigin;
    deliveryMode?: DeliveryMode | null;
    originDetail?: string | null;
    items: OrderItem[];
    discountPercent?: number | null;
    discountValue?: number | null;
    notes?: string | null;
    referenceDate?: Date | null;
    validUntil?: Date | null;
  }): Order {
    return new Order(
      OrderId.generate(),
      params.accountId,
      params.companyId,
      params.contactId,
      params.salesRepId ?? null,
      params.number,
      params.origin,
      params.deliveryMode ?? DEFAULT_DELIVERY_MODE,
      params.originDetail?.trim() || null,
      'rascunho',
      params.items,
      Math.max(0, Math.min(100, params.discountPercent ?? 0)),
      Math.max(0, round2(params.discountValue ?? 0)),
      params.notes?.trim() || null,
      params.referenceDate ?? new Date(),
      params.validUntil ?? null,
      new Date(),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static reconstitute(params: any): Order {
    return new Order(
      OrderId.from(params.id),
      params.accountId,
      params.companyId,
      params.contactId,
      params.salesRepId ?? null,
      params.number,
      params.origin,
      params.deliveryMode ?? DEFAULT_DELIVERY_MODE,
      params.originDetail ?? null,
      params.status,
      params.items,
      params.discountPercent ?? 0,
      params.discountValue ?? 0,
      params.notes ?? null,
      params.referenceDate,
      params.validUntil ?? null,
      params.createdAt,
    );
  }

  get id(): OrderId {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get companyId(): string {
    return this._companyId;
  }
  get contactId(): string {
    return this._contactId;
  }
  get salesRepId(): string | null {
    return this._salesRepId;
  }
  get number(): number {
    return this._number;
  }
  get origin(): OrderOrigin {
    return this._origin;
  }
  get deliveryMode(): DeliveryMode {
    return this._deliveryMode;
  }
  get originDetail(): string | null {
    return this._originDetail;
  }
  get status(): OrderStatus {
    return this._status;
  }
  get items(): readonly OrderItem[] {
    return this._items;
  }
  get discountPercent(): number {
    return this._discountPercent;
  }
  get discountValue(): number {
    return this._discountValue;
  }
  get notes(): string | null {
    return this._notes;
  }
  get referenceDate(): Date {
    return this._referenceDate;
  }
  get validUntil(): Date | null {
    return this._validUntil;
  }
  get createdAt(): Date {
    return this._createdAt;
  }

  /** Soma dos líquidos das linhas, antes do desconto de pedido. */
  get itemsTotal(): number {
    return round2(this._items.reduce((sum, item) => sum + item.netTotal, 0));
  }

  /** Desconto de pedido: valor tem precedência sobre percentual (mesma regra da linha). */
  get orderDiscount(): number {
    const raw =
      this._discountValue > 0
        ? this._discountValue
        : (this.itemsTotal * this._discountPercent) / 100;
    return round2(Math.min(raw, this.itemsTotal));
  }

  get total(): number {
    return round2(this.itemsTotal - this.orderDiscount);
  }

  /** Verdadeiro se QUALQUER desconto existe (item ou pedido) — governa a checagem de permissão. */
  get hasAnyDiscount(): boolean {
    return this.orderDiscount > 0 || this._items.some((item) => item.hasDiscount);
  }

  replaceItems(items: OrderItem[]): void {
    this._items = items;
  }

  editHeader(params: {
    origin?: OrderOrigin;
    deliveryMode?: DeliveryMode;
    originDetail?: string | null;
    salesRepId?: string | null;
    discountPercent?: number | null;
    discountValue?: number | null;
    notes?: string | null;
    referenceDate?: Date | null;
    validUntil?: Date | null;
  }): void {
    if (params.origin !== undefined) this._origin = params.origin;
    if (params.deliveryMode !== undefined) this._deliveryMode = params.deliveryMode;
    if (params.originDetail !== undefined) this._originDetail = params.originDetail?.trim() || null;
    if (params.salesRepId !== undefined) this._salesRepId = params.salesRepId;
    if (params.discountPercent !== undefined) {
      this._discountPercent = Math.max(0, Math.min(100, params.discountPercent ?? 0));
    }
    if (params.discountValue !== undefined) {
      this._discountValue = Math.max(0, round2(params.discountValue ?? 0));
    }
    if (params.notes !== undefined) this._notes = params.notes?.trim() || null;
    if (params.referenceDate !== undefined && params.referenceDate) {
      this._referenceDate = params.referenceDate;
    }
    if (params.validUntil !== undefined) this._validUntil = params.validUntil;
  }

  /** rascunho → orcamento. Proposta emitida ao cliente (§3.3 do 02A); não pode estar vazia. */
  quote(): void {
    if (this._items.length === 0) {
      throw new EmptyOrderException();
    }
    this.transitionTo('orcamento');
  }

  /** rascunho|orcamento → confirmado. O limite de crédito é conferido no use case ANTES disto. */
  confirm(): void {
    if (this._items.length === 0) {
      throw new EmptyOrderException();
    }
    this.transitionTo('confirmado');
  }

  complete(): void {
    this.transitionTo('concluido');
  }

  cancel(): void {
    this.transitionTo('cancelado');
  }

  /** faturar depende de EST/FIN/FIS — bloqueado LOUD no V1 (ver exceção). */
  invoice(): void {
    throw new InvoicingNotAvailableException();
  }

  private transitionTo(to: OrderStatus): void {
    if (STATUSES_REQUIRING_MODULES.includes(to)) {
      throw new InvoicingNotAvailableException();
    }
    if (!canTransition(this._status, to)) {
      throw new InvalidStatusTransitionException(this._status, to);
    }
    this._status = to;
  }
}
