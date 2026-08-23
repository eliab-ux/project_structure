import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { FieldReceiptAlreadyEffectuatedException } from '../exceptions/route-exceptions';

/** Formas do recebimento em campo (§3.2 do 04): inclui depósito bancário; à vista é exceção. */
export const FIELD_RECEIPT_METHODS = ['dinheiro', 'pix', 'cartao', 'cheque', 'deposito'] as const;
export type FieldReceiptMethod = (typeof FIELD_RECEIPT_METHODS)[number];

/**
 * Recebimento em campo (§3.2/§3.3 do 04) — os DOIS ESTÁGIOS da casa: o campo LANÇA (`proposto`) e a
 * retaguarda confere e EFETIVA (`efetivado` — só aí a baixa acontece no título do FIN). Nada do
 * campo grava definitivo sozinho.
 *
 * `insideWallet=false` = "outros recebimentos" (venda à vista em campo): classificado, mas FORA da
 * carteira — não entra no % de recebimento da comissão B.
 */
export class FieldReceipt extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _tripId: string,
    private readonly _titleId: string | null,
    private readonly _method: FieldReceiptMethod,
    private readonly _amount: number,
    private readonly _interest: number,
    private readonly _insideWallet: boolean,
    private _status: 'proposto' | 'efetivado',
    private _effectuatedAt: Date | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    tripId: string;
    /** Título cobrado. `null` só para "outros recebimentos" (fora da carteira). */
    titleId?: string | null;
    method: FieldReceiptMethod;
    amount: number;
    interest?: number | null;
    insideWallet?: boolean;
  }): FieldReceipt {
    return new FieldReceipt(
      randomUUID(),
      params.accountId,
      params.tripId,
      params.titleId ?? null,
      params.method,
      Math.max(0, params.amount),
      Math.max(0, params.interest ?? 0),
      params.insideWallet ?? params.titleId != null,
      'proposto',
      null,
      new Date(),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static reconstitute(params: any): FieldReceipt {
    return new FieldReceipt(
      params.id,
      params.accountId,
      params.tripId,
      params.titleId ?? null,
      params.method,
      Number(params.amount),
      Number(params.interest ?? 0),
      Boolean(params.insideWallet),
      params.status,
      params.effectuatedAt ?? null,
      params.createdAt,
    );
  }

  /** A efetivação da retaguarda — única vez; repetir efetivaria a baixa duas vezes. */
  effectuate(): void {
    if (this._status === 'efetivado') {
      throw new FieldReceiptAlreadyEffectuatedException();
    }
    this._status = 'efetivado';
    this._effectuatedAt = new Date();
  }

  get id(): string {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get tripId(): string {
    return this._tripId;
  }
  get titleId(): string | null {
    return this._titleId;
  }
  get method(): FieldReceiptMethod {
    return this._method;
  }
  get amount(): number {
    return this._amount;
  }
  get interest(): number {
    return this._interest;
  }
  get insideWallet(): boolean {
    return this._insideWallet;
  }
  get status(): 'proposto' | 'efetivado' {
    return this._status;
  }
  get effectuatedAt(): Date | null {
    return this._effectuatedAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
