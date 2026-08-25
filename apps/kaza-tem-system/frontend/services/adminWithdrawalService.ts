import { adminFetch } from './adminApi';

export interface AdminWithdrawal {
  id: string;
  resellerId: string;
  amount: number;
  status: 'requested' | 'approved' | 'paid' | 'rejected';
  bankName: string;
  bankAgency: string;
  bankAccount: string;
  bankAccountType?: string | null;
  pixKey?: string | null;
  createdAt: string;
}

export async function listWithdrawals(token: string, params: { status?: string } = {}) {
  const query = params.status ? `?status=${encodeURIComponent(params.status)}` : '';
  return adminFetch<AdminWithdrawal[]>(token, `/admin/withdrawals${query}`);
}

export async function approveWithdrawal(token: string, id: string, adminId: string) {
  return adminFetch(token, `/admin/withdrawals/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ adminId }),
  });
}

export async function rejectWithdrawal(token: string, id: string, adminId: string, reason: string) {
  return adminFetch(token, `/admin/withdrawals/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ adminId, reason }),
  });
}

export async function markWithdrawalPaid(token: string, id: string, adminId: string) {
  return adminFetch(token, `/admin/withdrawals/${id}/paid`, {
    method: 'POST',
    body: JSON.stringify({ adminId }),
  });
}
