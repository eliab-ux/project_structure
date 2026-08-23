import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';

/** Período da meta no formato `YYYY-MM` (mês). */
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Meta de venda de um vendedor num período (§2 do 02A) — base do Modelo A (`vendido ÷ meta`). Uma
 * por `(vendedor, período)`; pedir de novo o mesmo par SUBSTITUI (upsert no repositório).
 */
export class SalesTarget extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _userId: string,
    private readonly _period: string,
    private _targetValue: number,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    userId: string;
    period: string;
    targetValue: number;
  }): SalesTarget {
    if (!PERIOD_RE.test(params.period)) {
      throw new Error(`Período inválido: "${params.period}" (esperado YYYY-MM).`);
    }
    return new SalesTarget(
      randomUUID(),
      params.accountId,
      params.userId,
      params.period,
      Math.max(0, params.targetValue),
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    userId: string;
    period: string;
    targetValue: number;
    createdAt: Date;
  }): SalesTarget {
    return new SalesTarget(
      params.id,
      params.accountId,
      params.userId,
      params.period,
      params.targetValue,
      params.createdAt,
    );
  }

  changeTarget(value: number): void {
    this._targetValue = Math.max(0, value);
  }

  get id(): string {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get userId(): string {
    return this._userId;
  }
  get period(): string {
    return this._period;
  }
  get targetValue(): number {
    return this._targetValue;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
