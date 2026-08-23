import api from 'src/services/api';
import {
  CreateTitlePayload,
  FinancialAccount,
  FinancialAccountType,
  FinancialCategory,
  FinancialTitle,
  SettleTitlePayload,
  TitleDirection,
} from 'src/types/finance';

async function listAccounts(includeInactive = false): Promise<FinancialAccount[]> {
  const response = await api.get<FinancialAccount[]>('/finance/accounts', {
    params: { includeInactive },
  });
  return response.data;
}

async function createAccount(payload: {
  name: string;
  type: FinancialAccountType;
  institution?: string | null;
  initialBalance?: number;
}): Promise<FinancialAccount> {
  const response = await api.post<FinancialAccount>('/finance/accounts', payload);
  return response.data;
}

async function updateAccount(
  id: string,
  payload: { name?: string; institution?: string | null; active?: boolean },
): Promise<FinancialAccount> {
  const response = await api.patch<FinancialAccount>(`/finance/accounts/${id}`, payload);
  return response.data;
}

async function listCategories(includeInactive = false): Promise<FinancialCategory[]> {
  const response = await api.get<FinancialCategory[]>('/finance/categories', {
    params: { includeInactive },
  });
  return response.data;
}

async function createCategory(payload: {
  name: string;
  kind: string;
  parentId?: string | null;
  dreLine?: string | null;
  defaultOperation?: string | null;
}): Promise<FinancialCategory> {
  const response = await api.post<FinancialCategory>('/finance/categories', payload);
  return response.data;
}

async function updateCategory(
  id: string,
  payload: {
    name?: string;
    parentId?: string | null;
    dreLine?: string | null;
    defaultOperation?: string | null;
    active?: boolean;
  },
): Promise<FinancialCategory> {
  const response = await api.patch<FinancialCategory>(`/finance/categories/${id}`, payload);
  return response.data;
}

async function listTitles(
  direction: TitleDirection,
  params: { companyId?: string; contactId?: string; status?: string } = {},
): Promise<FinancialTitle[]> {
  const path = direction === 'receivable' ? '/finance/receivables' : '/finance/payables';
  const response = await api.get<FinancialTitle[]>(path, { params });
  return response.data;
}

async function createTitle(
  direction: TitleDirection,
  payload: CreateTitlePayload,
): Promise<FinancialTitle> {
  const path = direction === 'receivable' ? '/finance/receivables' : '/finance/payables';
  const response = await api.post<FinancialTitle>(path, payload);
  return response.data;
}

async function createRecurringPayable(
  payload: CreateTitlePayload & { firstDueDate: string; occurrences: number },
): Promise<FinancialTitle[]> {
  const response = await api.post<FinancialTitle[]>('/finance/payables/recurring', payload);
  return response.data;
}

async function settleTitle(id: string, payload: SettleTitlePayload): Promise<FinancialTitle> {
  const response = await api.post<FinancialTitle>(`/finance/titles/${id}/settle`, payload);
  return response.data;
}

const financeService = {
  listAccounts,
  createAccount,
  updateAccount,
  listCategories,
  createCategory,
  updateCategory,
  listTitles,
  createTitle,
  createRecurringPayable,
  settleTitle,
};

export default financeService;
