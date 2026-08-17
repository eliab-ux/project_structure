import api from 'src/services/api';
import { Balances, BankAccount, CashEntry, Dre, FinancialCategory } from 'src/types/finance';

async function listBankAccounts(): Promise<BankAccount[]> {
  const response = await api.get<BankAccount[]>('/finance/bank-accounts');
  return response.data;
}

async function createBankAccount(payload: {
  name: string;
  bank?: string | null;
  openingBalanceCents?: number;
}): Promise<BankAccount> {
  const response = await api.post<BankAccount>('/finance/bank-accounts', payload);
  return response.data;
}

async function updateBankAccount(
  id: string,
  payload: { name: string; bank?: string | null; openingBalanceCents: number; isActive: boolean },
): Promise<BankAccount> {
  const response = await api.put<BankAccount>(`/finance/bank-accounts/${id}`, payload);
  return response.data;
}

async function listCategories(): Promise<FinancialCategory[]> {
  const response = await api.get<FinancialCategory[]>('/finance/categories');
  return response.data;
}

async function createCategory(payload: {
  name: string;
  direction: 'in' | 'out';
}): Promise<FinancialCategory> {
  const response = await api.post<FinancialCategory>('/finance/categories', payload);
  return response.data;
}

/** Cria as categorias-semente que faltarem. Idempotente — chamar de novo não duplica nada. */
async function seedDefaultCategories(): Promise<FinancialCategory[]> {
  const response = await api.post<FinancialCategory[]>('/finance/categories/defaults');
  return response.data;
}

async function listEntries(from: string, to: string, bankAccountId?: string): Promise<CashEntry[]> {
  const response = await api.get<CashEntry[]>('/finance/entries', {
    params: { from, to, ...(bankAccountId ? { bankAccountId } : {}) },
  });
  return response.data;
}

async function createEntry(payload: {
  type: 'in' | 'out';
  occurredOn: string;
  amountCents: number;
  categoryId: string;
  bankAccountId: string;
  description: string;
  payee?: string | null;
  paymentMethod?: string | null;
}): Promise<CashEntry> {
  const response = await api.post<CashEntry>('/finance/entries', payload);
  return response.data;
}

async function createTransfer(payload: {
  occurredOn: string;
  amountCents: number;
  fromAccountId: string;
  toAccountId: string;
  description: string;
}): Promise<CashEntry> {
  const response = await api.post<CashEntry>('/finance/entries/transfers', payload);
  return response.data;
}

/**
 * Cancela com motivo. **Não existe `updateEntry`** — e a ausência é a regra (§4.15): valor de
 * lançamento efetivado não se corrige, cancela-se e lança-se de novo.
 */
async function cancelEntry(id: string, reason: string): Promise<CashEntry> {
  const response = await api.patch<CashEntry>(`/finance/entries/${id}/cancel`, { reason });
  return response.data;
}

async function dre(from: string, to: string): Promise<Dre> {
  const response = await api.get<Dre>('/finance/dre', { params: { from, to } });
  return response.data;
}

async function balances(until?: string): Promise<Balances> {
  const response = await api.get<Balances>('/finance/balances', {
    params: until ? { until } : {},
  });
  return response.data;
}

const financeService = {
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  listCategories,
  createCategory,
  seedDefaultCategories,
  listEntries,
  createEntry,
  createTransfer,
  cancelEntry,
  dre,
  balances,
};
export default financeService;
