import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { valorPorExtenso } from '../valor-por-extenso';

/**
 * Promissória (§3.1 do 04): gerada NA PONTA sobre o total do pedido, **1 por pedido**, assinada como
 * GARANTIA da consignação. Guarda o SNAPSHOT da devedora (nome, CPF, endereço) e o valor por extenso
 * — o que a térmica imprime. A impressão (térmica/PDF) é do app/EXP; aqui vive o DADO.
 */
export class PromissoryNote extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _orderId: string,
    private readonly _amount: number,
    private readonly _amountInWords: string,
    private readonly _debtorName: string,
    private readonly _debtorDocument: string | null,
    private readonly _debtorAddress: string | null,
    private readonly _dueDate: Date,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    orderId: string;
    amount: number;
    debtorName: string;
    debtorDocument?: string | null;
    debtorAddress?: string | null;
    /** Vencimento ≈ próxima passagem pela rota. */
    dueDate: Date;
  }): PromissoryNote {
    const amount = Math.round((Math.max(0, params.amount) + Number.EPSILON) * 100) / 100;
    return new PromissoryNote(
      randomUUID(),
      params.accountId,
      params.orderId,
      amount,
      valorPorExtenso(amount),
      params.debtorName.trim(),
      params.debtorDocument?.trim() || null,
      params.debtorAddress?.trim() || null,
      params.dueDate,
      new Date(),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static reconstitute(params: any): PromissoryNote {
    return new PromissoryNote(
      params.id,
      params.accountId,
      params.orderId,
      Number(params.amount),
      params.amountInWords,
      params.debtorName,
      params.debtorDocument ?? null,
      params.debtorAddress ?? null,
      params.dueDate,
      params.createdAt,
    );
  }

  get id(): string {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get orderId(): string {
    return this._orderId;
  }
  get amount(): number {
    return this._amount;
  }
  get amountInWords(): string {
    return this._amountInWords;
  }
  get debtorName(): string {
    return this._debtorName;
  }
  get debtorDocument(): string | null {
    return this._debtorDocument;
  }
  get debtorAddress(): string | null {
    return this._debtorAddress;
  }
  get dueDate(): Date {
    return this._dueDate;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
