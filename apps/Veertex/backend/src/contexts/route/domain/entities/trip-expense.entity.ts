import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';

/** Categorias de despesa da viagem (§3.5 do 04) — as das planilhas reais. */
export const TRIP_EXPENSE_CATEGORIES = [
  'combustivel',
  'alimentacao',
  'hotel',
  'pedagio',
  'manutencao',
  'outros',
] as const;
export type TripExpenseCategory = (typeof TRIP_EXPENSE_CATEGORIES)[number];

/** Despesa da viagem (§3.5 do 04) — lançamento diário por categoria; entra no batimento. */
export class TripExpense extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _tripId: string,
    private readonly _category: TripExpenseCategory,
    private readonly _amount: number,
    private readonly _note: string | null,
    private readonly _spentAt: Date,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    tripId: string;
    category: TripExpenseCategory;
    amount: number;
    note?: string | null;
    spentAt?: Date | null;
  }): TripExpense {
    return new TripExpense(
      randomUUID(),
      params.accountId,
      params.tripId,
      params.category,
      Math.max(0, params.amount),
      params.note?.trim() || null,
      params.spentAt ?? new Date(),
      new Date(),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static reconstitute(params: any): TripExpense {
    return new TripExpense(
      params.id,
      params.accountId,
      params.tripId,
      params.category,
      Number(params.amount),
      params.note ?? null,
      params.spentAt,
      params.createdAt,
    );
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
  get category(): TripExpenseCategory {
    return this._category;
  }
  get amount(): number {
    return this._amount;
  }
  get note(): string | null {
    return this._note;
  }
  get spentAt(): Date {
    return this._spentAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
