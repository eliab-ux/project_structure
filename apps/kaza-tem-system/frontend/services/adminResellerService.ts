import { adminFetch } from './adminApi';

export interface AdminResellerSummary {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  cpf: string;
  uniqueLink: string;
  status: string;
  level: string;
  canSetCustomPrice: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  phone: string | null;
  bankName: string | null;
  bankCode: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  bankAccountType: string | null;
  bankHolderName: string | null;
  bankHolderCpf: string | null;
  pixKey: string | null;
  pixKeyType: string | null;
  totalSoldYear: number;
  suspendedAt: string | null;
  suspensionReason: string | null;
  subscriptionStatus: string | null;
  subscriptionAmount: number | null;
  subscriptionNextBilling: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminResellerListResult {
  total: number;
  items: AdminResellerSummary[];
}

export interface AdminResellerWithdrawal {
  id: string;
  resellerId: string;
  amount: number;
  status: string;
  commissionIds: string[];
  bankName: string;
  bankAgency: string;
  bankAccount: string;
  bankAccountType?: string | null;
  pixKey?: string | null;
  blingPayableId?: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  paidAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminResellerDetail {
  reseller: {
    id: string;
    fullName: string;
    cpf: string;
    uniqueLink: string;
    status: string;
    level: string;
    phone: string | null;
    approvedAt: string | null;
    approvedBy: string | null;
    suspendedAt: string | null;
    suspensionReason: string | null;
    totalSoldYear: number;
    createdAt: string;
    updatedAt: string;
  };
  user: {
    name: string | null;
    email: string | null;
  };
  bank: {
    bankName: string | null;
    bankCode: string | null;
    bankAgency: string | null;
    bankAccount: string | null;
    bankAccountType: string | null;
    bankHolderName: string | null;
    bankHolderCpf: string | null;
    pixKey: string | null;
    pixKeyType: string | null;
  };
  subscription: {
    status: string;
    amount: number;
    nextBillingDate: string | null;
  } | null;
  metrics: {
    totalOrders: number;
    ordersLast30Days: number;
    monthlySales: number;
    balance: {
      pending: number;
      available: number;
      withdrawn: number;
      debt: number;
    };
  };
  withdrawals: AdminResellerWithdrawal[];
}

function buildQuery(params?: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  if (!params) {
    return '';
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
}

export async function getPendingResellers(
  token: string,
  options?: { limit?: number; offset?: number },
): Promise<AdminResellerSummary[]> {
  const query = buildQuery({ limit: options?.limit, offset: options?.offset });
  return adminFetch<AdminResellerSummary[]>(token, `/admin/resellers/pending${query}`);
}

export async function approveReseller(token: string, resellerId: string, approvedBy: string) {
  await adminFetch<void>(token, `/resellers/${resellerId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy }),
  });
}

export async function rejectReseller(token: string, resellerId: string, reason: string) {
  await adminFetch<void>(token, `/admin/resellers/${resellerId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function listResellers(
  token: string,
  options?: {
    status?: string;
    level?: string;
    search?: string;
    limit?: number;
    offset?: number;
  },
): Promise<AdminResellerListResult> {
  const query = buildQuery({
    status: options?.status,
    level: options?.level,
    search: options?.search,
    limit: options?.limit,
    offset: options?.offset,
  });
  return adminFetch<AdminResellerListResult>(token, `/admin/resellers${query}`);
}

export async function getResellerDetail(token: string, resellerId: string): Promise<AdminResellerDetail> {
  return adminFetch<AdminResellerDetail>(token, `/admin/resellers/${resellerId}`);
}

export async function suspendReseller(token: string, resellerId: string, reason: string) {
  await adminFetch<void>(token, `/admin/resellers/${resellerId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function reactivateReseller(token: string, resellerId: string) {
  await adminFetch<void>(token, `/admin/resellers/${resellerId}/reactivate`, {
    method: 'POST',
  });
}
