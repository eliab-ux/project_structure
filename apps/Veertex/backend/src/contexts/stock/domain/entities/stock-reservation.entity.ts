import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';

export type ReservationStatus = 'active' | 'released';
export type ReleaseReason = 'cancelled' | 'invoiced' | 'expired';

/**
 * Uma reserva de estoque (§3.9 do 02 / §3.3 do 03). NÃO é movimento — não altera o saldo físico,
 * reduz o DISPONÍVEL. O pedido (VND) a cria ao confirmar; ela é liberada por cancelamento ou
 * faturamento, e EXPIRA por TTL.
 *
 * ## Expiração PREGUIÇOSA (decisão de 22/08/2026)
 *
 * A reserva vencida (`expiresAt` passado) deixa de contar no disponível — a consulta a ignora. Não
 * há agendador: o `status` continua `active` no banco, mas ela não reserva mais nada. O EVENTO
 * visível de expiração (marcar `expired` e avisar) entra junto com o BullMQ que a geocodificação vai
 * exigir (§8 do 01A). Até lá, `isCounting(now)` é a verdade do disponível.
 */
export class StockReservation extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _companyId: string,
    private readonly _productId: string,
    private readonly _orderId: string | null,
    private _quantity: number,
    private _status: ReservationStatus,
    private _releaseReason: ReleaseReason | null,
    private readonly _expiresAt: Date,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    companyId: string;
    productId: string;
    orderId?: string | null;
    quantity: number;
    ttlHours: number;
    now: Date;
  }): StockReservation {
    return new StockReservation(
      randomUUID(),
      params.accountId,
      params.companyId,
      params.productId,
      params.orderId ?? null,
      params.quantity,
      'active',
      null,
      new Date(params.now.getTime() + params.ttlHours * 3600_000),
      params.now,
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    companyId: string;
    productId: string;
    orderId: string | null;
    quantity: number;
    status: ReservationStatus;
    releaseReason: ReleaseReason | null;
    expiresAt: Date;
    createdAt: Date;
  }): StockReservation {
    return new StockReservation(
      params.id,
      params.accountId,
      params.companyId,
      params.productId,
      params.orderId,
      params.quantity,
      params.status,
      params.releaseReason,
      params.expiresAt,
      params.createdAt,
    );
  }

  release(reason: ReleaseReason): void {
    if (this._status === 'active') {
      this._status = 'released';
      this._releaseReason = reason;
    }
  }

  /** Conta para o disponível? Ativa E ainda não vencida (expiração preguiçosa). */
  isCounting(now: Date): boolean {
    return this._status === 'active' && this._expiresAt.getTime() > now.getTime();
  }

  get id(): string {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get companyId(): string {
    return this._companyId;
  }
  get productId(): string {
    return this._productId;
  }
  get orderId(): string | null {
    return this._orderId;
  }
  get quantity(): number {
    return this._quantity;
  }
  get status(): ReservationStatus {
    return this._status;
  }
  get releaseReason(): ReleaseReason | null {
    return this._releaseReason;
  }
  get expiresAt(): Date {
    return this._expiresAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
