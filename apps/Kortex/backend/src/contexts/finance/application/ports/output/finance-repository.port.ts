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

/**
 * A reserva que originou um lançamento — **read model**, só para exibição.
 *
 * O financeiro não carrega a entidade `Reservation`: ele não decide nada sobre reserva, só precisa
 * mostrar de onde o dinheiro veio. Buscar o agregado inteiro para escrever uma linha de extrato
 * obrigaria o `FinanceModule` a importar o `ScheduleModule` — que já importa o financeiro pelo
 * `CASH_RECORDER`, fechando um ciclo entre os dois módulos.
 */
export interface ReservationRef {
  reservationId: string;
  customerName: string;
  machineName: string;
  /** ISO. O início da hora de máquina, que é o que o Administrativo reconhece na agenda. */
  startsAt: string;
  hours: number;
  totalCents: number;
  status: string;
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

  /**
   * As reservas por trás dos lançamentos, em UMA consulta.
   *
   * Recebe a lista inteira de ids em vez de ser chamada por linha: um extrato de mês com 80
   * pagamentos faria 80 idas ao banco para escrever 80 linhas de tela.
   */
  reservationRefs(accountId: AccountId, reservationIds: string[]): Promise<ReservationRef[]>;
}
