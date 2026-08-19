import { BankAccount } from '../../domain/entities/bank-account.entity';
import {
  CategoryDirection,
  FinancialCategory,
} from '../../domain/entities/financial-category.entity';
import { CashEntry, CashEntryType } from '../../domain/entities/cash-entry.entity';
import { PaymentMethod } from '../../../schedule/domain/entities/reservation.entity';
import { NamedRef } from '../../../pre-order/application/dto/pre-order.dto';
import { AccountBalance, DreLine, ReservationRef } from '../ports/output/finance-repository.port';

export class BankAccountDto {
  id!: string;
  name!: string;
  bank!: string | null;
  openingBalanceCents!: number;
  isActive!: boolean;

  static fromDomain(bankAccount: BankAccount): BankAccountDto {
    const dto = new BankAccountDto();
    dto.id = bankAccount.id.value;
    dto.name = bankAccount.name;
    dto.bank = bankAccount.bank;
    dto.openingBalanceCents = bankAccount.openingBalanceCents;
    dto.isActive = bankAccount.isActive;
    return dto;
  }
}

export class FinancialCategoryDto {
  id!: string;
  name!: string;
  direction!: CategoryDirection;
  isActive!: boolean;

  static fromDomain(category: FinancialCategory): FinancialCategoryDto {
    const dto = new FinancialCategoryDto();
    dto.id = category.id.value;
    dto.name = category.name;
    dto.direction = category.direction;
    dto.isActive = category.isActive;
    return dto;
  }
}

/** Lançamento como o extrato o mostra. Cancelado vem junto, com motivo e autor. */
export class CashEntryDto {
  id!: string;
  type!: CashEntryType;
  occurredOn!: string;
  amountCents!: number;
  category!: NamedRef | null;
  bankAccount!: NamedRef;
  counterpartAccount!: NamedRef | null;
  description!: string;
  payee!: string | null;
  paymentMethod!: PaymentMethod | null;
  reservationId!: string | null;
  /**
   * A reserva que gerou a entrada — cliente, máquina, horário e valor.
   *
   * Só o `reservationId` não serve para ninguém: um uuid no extrato não responde "de quem foi
   * esse pagamento?". Com o pagamento sendo a catraca que libera a reserva para o Modelista, o
   * caminho de volta do dinheiro até o pedido precisa estar na tela.
   */
  reservation!: ReservationRef | null;
  createdBy!: NamedRef;
  cancelledAt!: string | null;
  cancelledReason!: string | null;
  cancelledBy!: NamedRef | null;

  static fromDomain(
    entry: CashEntry,
    refs: {
      category: NamedRef | null;
      bankAccount: NamedRef;
      counterpartAccount: NamedRef | null;
      createdBy: NamedRef;
      cancelledBy: NamedRef | null;
      reservation: ReservationRef | null;
    },
  ): CashEntryDto {
    const dto = new CashEntryDto();
    dto.id = entry.id.value;
    dto.type = entry.type;
    dto.occurredOn = entry.occurredOn.toISOString().slice(0, 10);
    dto.amountCents = entry.amount.cents;
    dto.category = refs.category;
    dto.bankAccount = refs.bankAccount;
    dto.counterpartAccount = refs.counterpartAccount;
    dto.description = entry.description;
    dto.payee = entry.payee;
    dto.paymentMethod = entry.paymentMethod;
    dto.reservationId = entry.reservationId?.value ?? null;
    dto.reservation = refs.reservation;
    dto.createdBy = refs.createdBy;
    dto.cancelledAt = entry.cancellation?.at.toISOString() ?? null;
    dto.cancelledReason = entry.cancellation?.reason ?? null;
    dto.cancelledBy = refs.cancelledBy;
    return dto;
  }
}

/**
 * DRE de caixa do período (§4.16).
 *
 * `transfer` **não aparece** em entradas nem em saídas: não é receita nem despesa, só move saldo
 * entre contas próprias.
 */
export class DreDto {
  from!: string;
  to!: string;
  incomes!: DreLine[];
  expenses!: DreLine[];
  totalIncomeCents!: number;
  totalExpenseCents!: number;
  /** `entradas − saídas`. É o fechamento do mês. */
  resultCents!: number;

  static create(from: Date, to: Date, lines: DreLine[]): DreDto {
    const dto = new DreDto();
    dto.from = from.toISOString().slice(0, 10);
    dto.to = to.toISOString().slice(0, 10);
    dto.incomes = lines.filter((line) => line.direction === 'in');
    dto.expenses = lines.filter((line) => line.direction === 'out');
    dto.totalIncomeCents = dto.incomes.reduce((sum, line) => sum + line.totalCents, 0);
    dto.totalExpenseCents = dto.expenses.reduce((sum, line) => sum + line.totalCents, 0);
    dto.resultCents = dto.totalIncomeCents - dto.totalExpenseCents;
    return dto;
  }
}

export class BalancesDto {
  accounts!: AccountBalance[];
  totalBalanceCents!: number;

  static create(balances: AccountBalance[]): BalancesDto {
    const dto = new BalancesDto();
    dto.accounts = balances;
    dto.totalBalanceCents = balances.reduce((sum, account) => sum + account.balanceCents, 0);
    return dto;
  }
}
