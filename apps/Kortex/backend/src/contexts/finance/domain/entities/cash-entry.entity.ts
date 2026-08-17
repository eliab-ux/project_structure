import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { Money } from '../../../../shared/domain/value-objects/money.vo';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../../../user/domain/value-objects/user-id.vo';
import { ReservationId } from '../../../schedule/domain/value-objects/reservation-id.vo';
import { PaymentMethod } from '../../../schedule/domain/entities/reservation.entity';
import { BankAccountId, CashEntryId, FinancialCategoryId } from '../value-objects/finance-ids.vo';
import { CashEntryAlreadyCancelledException } from '../exceptions/finance.exceptions';

export const CASH_ENTRY_TYPES = ['in', 'out', 'transfer'] as const;
export type CashEntryType = (typeof CASH_ENTRY_TYPES)[number];

export const CASH_ENTRY_TYPE_LABELS: Record<CashEntryType, string> = {
  in: 'Entrada',
  out: 'Saída',
  transfer: 'Transferência',
};

interface Cancellation {
  at: Date;
  reason: string;
  by: UserId;
}

/**
 * Um lançamento de caixa (spec §4.15).
 *
 * **Regime de caixa, não de competência**: o lançamento conta no mês de `occurredOn`, a data em
 * que o dinheiro entrou ou saiu. Reserva de outubro paga em agosto entra no caixa de agosto. Não
 * existe campo de competência nem rateio por período.
 *
 * **Lançamento não é apagado, é cancelado** — com motivo e autor. Saldo e DRE ignoram os
 * cancelados, mas eles continuam consultáveis. E **não existe edição de valor**: a entidade não
 * tem setter de `amount` nem de `type`. Errou, cancela e lança de novo — assim a trilha mostra as
 * duas coisas, em vez de um número que mudou sem explicação.
 *
 * **Transferência entre contas próprias não é receita nem despesa** e fica fora do DRE: só move
 * saldo entre `bankAccountId` e `counterpartAccountId`. Sem isso, tirar dinheiro da conta da
 * máquina para a conta principal inflaria entradas e saídas do mês.
 */
export class CashEntry extends AggregateRoot {
  private constructor(
    private readonly _id: CashEntryId,
    private readonly _accountId: AccountId,
    private readonly _type: CashEntryType,
    private readonly _occurredOn: Date,
    private readonly _amount: Money,
    private readonly _categoryId: FinancialCategoryId | null,
    private readonly _bankAccountId: BankAccountId,
    private readonly _counterpartAccountId: BankAccountId | null,
    private readonly _description: string,
    private readonly _payee: string | null,
    private readonly _paymentMethod: PaymentMethod | null,
    private readonly _reservationId: ReservationId | null,
    private readonly _createdBy: UserId,
    private _cancellation: Cancellation | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  /** Entrada ou saída manual. Exige categoria e não tem contrapartida. */
  static record(input: {
    accountId: AccountId;
    type: 'in' | 'out';
    occurredOn: Date;
    amount: Money;
    categoryId: FinancialCategoryId;
    bankAccountId: BankAccountId;
    description: string;
    payee?: string | null;
    paymentMethod?: PaymentMethod | null;
    reservationId?: ReservationId | null;
    createdBy: UserId;
  }): CashEntry {
    const now = new Date();
    return new CashEntry(
      CashEntryId.create(),
      input.accountId,
      input.type,
      CashEntry.assertDate(input.occurredOn),
      input.amount,
      input.categoryId,
      input.bankAccountId,
      null,
      CashEntry.assertDescription(input.description),
      CashEntry.normalize(input.payee, 200, 'Favorecido'),
      input.paymentMethod ?? null,
      input.reservationId ?? null,
      input.createdBy,
      null,
      now,
      now,
    );
  }

  /**
   * Transferência entre contas próprias.
   *
   * Sem categoria de propósito — ela não é receita nem despesa, e dar-lhe uma categoria a
   * colocaria no DRE pela porta dos fundos.
   */
  static transfer(input: {
    accountId: AccountId;
    occurredOn: Date;
    amount: Money;
    fromAccountId: BankAccountId;
    toAccountId: BankAccountId;
    description: string;
    createdBy: UserId;
  }): CashEntry {
    if (input.fromAccountId.value === input.toAccountId.value) {
      throw new InvalidValueException('A conta de destino deve ser diferente da conta de origem.');
    }

    const now = new Date();
    return new CashEntry(
      CashEntryId.create(),
      input.accountId,
      'transfer',
      CashEntry.assertDate(input.occurredOn),
      input.amount,
      null,
      input.fromAccountId,
      input.toAccountId,
      CashEntry.assertDescription(input.description),
      null,
      null,
      null,
      input.createdBy,
      null,
      now,
      now,
    );
  }

  static restore(input: {
    id: CashEntryId;
    accountId: AccountId;
    type: CashEntryType;
    occurredOn: Date;
    amount: Money;
    categoryId: FinancialCategoryId | null;
    bankAccountId: BankAccountId;
    counterpartAccountId: BankAccountId | null;
    description: string;
    payee: string | null;
    paymentMethod: PaymentMethod | null;
    reservationId: ReservationId | null;
    createdBy: UserId;
    cancellation: Cancellation | null;
    createdAt: Date;
    updatedAt: Date;
  }): CashEntry {
    return new CashEntry(
      input.id,
      input.accountId,
      input.type,
      input.occurredOn,
      input.amount,
      input.categoryId,
      input.bankAccountId,
      input.counterpartAccountId,
      input.description,
      input.payee,
      input.paymentMethod,
      input.reservationId,
      input.createdBy,
      input.cancellation,
      input.createdAt,
      input.updatedAt,
    );
  }

  /**
   * Cancela com motivo e autor. Não apaga: o lançamento continua consultável, fora do saldo e do
   * DRE.
   */
  cancel(reason: string, by: UserId, at: Date = new Date()): void {
    if (this._cancellation) {
      throw new CashEntryAlreadyCancelledException();
    }

    const trimmed = (reason ?? '').trim();
    if (trimmed.length < 3 || trimmed.length > 300) {
      throw new InvalidValueException(
        'O motivo do cancelamento deve ter entre 3 e 300 caracteres — é o que permite auditar depois.',
      );
    }

    this._cancellation = { at, reason: trimmed, by };
    this._updatedAt = new Date();
  }

  get isCancelled(): boolean {
    return this._cancellation !== null;
  }

  /**
   * Efeito no saldo de uma conta específica, em centavos.
   *
   * Entrada soma na conta; saída subtrai; transferência subtrai na origem e soma no destino.
   * Cancelado não move nada.
   */
  effectOn(bankAccountId: BankAccountId): number {
    if (this._cancellation) {
      return 0;
    }
    const cents = this._amount.cents;

    if (this._bankAccountId.value === bankAccountId.value) {
      return this._type === 'in' ? cents : -cents;
    }
    if (this._counterpartAccountId?.value === bankAccountId.value) {
      // Só transferência tem contrapartida, e nela a contrapartida é o destino.
      return cents;
    }
    return 0;
  }

  private static assertDate(date: Date): Date {
    if (Number.isNaN(date.getTime())) {
      throw new InvalidValueException('Data do lançamento inválida.');
    }
    return date;
  }

  private static assertDescription(description: string): string {
    const value = (description ?? '').trim();
    if (value.length < 2 || value.length > 300) {
      throw new InvalidValueException('A descrição do lançamento é obrigatória.');
    }
    return value;
  }

  private static normalize(
    value: string | null | undefined,
    max: number,
    label: string,
  ): string | null {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.length > max) {
      throw new InvalidValueException(`${label} deve ter no máximo ${max} caracteres.`);
    }
    return trimmed;
  }

  get id(): CashEntryId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get type(): CashEntryType {
    return this._type;
  }

  get occurredOn(): Date {
    return this._occurredOn;
  }

  get amount(): Money {
    return this._amount;
  }

  get categoryId(): FinancialCategoryId | null {
    return this._categoryId;
  }

  get bankAccountId(): BankAccountId {
    return this._bankAccountId;
  }

  get counterpartAccountId(): BankAccountId | null {
    return this._counterpartAccountId;
  }

  get description(): string {
    return this._description;
  }

  get payee(): string | null {
    return this._payee;
  }

  get paymentMethod(): PaymentMethod | null {
    return this._paymentMethod;
  }

  get reservationId(): ReservationId | null {
    return this._reservationId;
  }

  get createdBy(): UserId {
    return this._createdBy;
  }

  get cancellation(): Cancellation | null {
    return this._cancellation;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
