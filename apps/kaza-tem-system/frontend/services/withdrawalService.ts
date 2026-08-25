import api from './api';

export interface WithdrawalBankDataPayload {
  bankName: string;
  bankAgency: string;
  bankAccount: string;
  bankAccountType?: string | null;
  pixKey?: string | null;
}

export interface ResellerWithdrawal {
  id: string;
  resellerId: string;
  amount: number;
  status: 'requested' | 'approved' | 'paid' | 'rejected';
  bankName: string;
  bankAgency: string;
  bankAccount: string;
  bankAccountType?: string | null;
  pixKey?: string | null;
  blingPayableId?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listWithdrawals(): Promise<ResellerWithdrawal[]> {
  const response = await api.get<ResellerWithdrawal[]>('/withdrawals');
  return response.data;
}

export async function requestWithdrawal(
  bankData: WithdrawalBankDataPayload,
): Promise<ResellerWithdrawal> {
  const response = await api.post<ResellerWithdrawal>('/withdrawals', { bankData });
  return response.data;
}
