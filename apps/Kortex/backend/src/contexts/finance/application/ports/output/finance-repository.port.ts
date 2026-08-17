import { BankAccount } from '../../../domain/entities/bank-account.entity';
import { FinancialCategory } from '../../../domain/entities/financial-category.entity';
import { CashEntry } from '../../../domain/entities/cash-entry.entity';
import {
  BankAccountId,
  CashEntryId,
  FinancialCategoryId,
} from '../../../domain/value-objects/finance-ids.vo';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { ReservationId } from '../../../../schedule/domain/value-objects/reservation-id.vo';

export const BANK_ACCOUNT_REPOSITORY = Symbol('BANK_ACCOUNT_REPOSITORY');
export const FINANCIAL_CATEGORY_REPOSITORY = Symbol('FINANCIAL_CATEGORY_REPOSITORY');
export const CASH_ENTRY_REPOSITORY = Symbol('CASH_ENTRY_REPOSITORY');

export interface BankAccountRepositoryPort {
  listByAccount(accountId: AccountId): Promise<BankAccount[]>;
  findById(accountId: AccountId, id: BankAccountId): Promise<BankAccount | null>;
  save(bankAccount: BankAccount): Promise<BankAccount>;
}

export interface FinancialCategoryRepositoryPort {
  listByAccount(accountId: AccountId): Promise<FinancialCategory[]>;
  findById(accountId: AccountId, id: FinancialCategoryId): Promise<FinancialCategory | null>;
  findByName(
    accountId: AccountId,
    name: string,
    direction: string,
  ): Promise<FinancialCategory | null>;
  save(category: FinancialCategory): Promise<FinancialCategory>;
}

/** Uma linha do DRE: total de uma categoria no período. */
export interface DreLine {
  categoryId: string;
  categoryName: string;
  direction: 'in' | 'out';
  totalCents: number;
}

/** Saldo de uma conta: inicial + movimentação, tudo em centavos. */
export interface AccountBalance {
  bankAccountId: string;
  name: string;
  openingBalanceCents: number;
  inCents: number;
  outCents: number;
  transferInCents: number;
  transferOutCents: number;
  balanceCents: number;
}

export interface CashEntryRepositoryPort {
  listByPeriod(
    accountId: AccountId,
    from: Date,
    to: Date,
    bankAccountId?: BankAccountId | null,
  ): Promise<CashEntry[]>;
  findById(accountId: AccountId, id: CashEntryId): Promise<CashEntry | null>;
  /** A entrada viva de uma reserva, se existir — a base da não-duplicação. */
  findLiveByReservation(
    accountId: AccountId,
    reservationId: ReservationId,
  ): Promise<CashEntry | null>;
  save(entry: CashEntry): Promise<CashEntry>;

  /**
   * DRE de caixa por categoria no período (§4.16).
   *
   * **`transfer` nunca entra** e cancelados são ignorados — as duas exclusões acontecem no SQL,
   * não em `filter` depois, porque é a agregação do banco que precisa estar certa.
   */
  dre(accountId: AccountId, from: Date, to: Date): Promise<DreLine[]>;

  /** Saldo de cada conta: inicial + entradas + transferências recebidas − saídas − enviadas. */
  balances(accountId: AccountId, until: Date): Promise<AccountBalance[]>;
}
