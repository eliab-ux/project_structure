import { PaymentMethod } from 'src/types/schedule';

export interface NamedRef {
  id: string;
  name: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bank: string | null;
  openingBalanceCents: number;
  isActive: boolean;
}

export type CategoryDirection = 'in' | 'out';

export const CATEGORY_DIRECTION_LABELS: Record<CategoryDirection, string> = {
  in: 'Entrada',
  out: 'Saída',
};

export interface FinancialCategory {
  id: string;
  name: string;
  direction: CategoryDirection;
  isActive: boolean;
}

export type CashEntryType = 'in' | 'out' | 'transfer';

export const CASH_ENTRY_TYPE_LABELS: Record<CashEntryType, string> = {
  in: 'Entrada',
  out: 'Saída',
  transfer: 'Transferência',
};

export interface CashEntry {
  id: string;
  type: CashEntryType;
  occurredOn: string;
  amountCents: number;
  category: NamedRef | null;
  bankAccount: NamedRef;
  counterpartAccount: NamedRef | null;
  description: string;
  payee: string | null;
  paymentMethod: PaymentMethod | null;
  /** Preenchido quando a entrada nasceu do pagamento de uma reserva. */
  reservationId: string | null;
  createdBy: NamedRef;
  cancelledAt: string | null;
  cancelledReason: string | null;
  cancelledBy: NamedRef | null;
}

export interface DreLine {
  categoryId: string;
  categoryName: string;
  direction: CategoryDirection;
  totalCents: number;
}

export interface Dre {
  from: string;
  to: string;
  incomes: DreLine[];
  expenses: DreLine[];
  totalIncomeCents: number;
  totalExpenseCents: number;
  resultCents: number;
}

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

export interface Balances {
  accounts: AccountBalance[];
  totalBalanceCents: number;
}

/** 'AAAA-MM-DD' → '05/10/2026'. Data de calendário: sem `new Date`, que puxaria fuso para dentro. */
export function formatDay(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

/** Primeiro e último dia do mês de uma data, no formato que a API espera. */
export function monthRange(reference: Date): { from: string; to: string } {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to: `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`,
  };
}

/** '1.234,56' ou '1234,56' → 123456 centavos. O operador digita em reais; a API fala centavos. */
export function toCents(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.').trim();
  return Math.round(Number(normalized) * 100);
}
