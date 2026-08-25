import api from './api';

export interface ResellerProfileResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  reseller: {
    id: string;
    userId: string;
    uniqueLink: string;
    cpf: string;
    fullName: string;
    level: string;
    status: string;
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
    createdAt: string;
    updatedAt: string;
  };
}

export interface UpdateResellerProfilePayload {
  fullName?: string | null;
  phone?: string | null;
}

export interface UpdateResellerBankInfoPayload {
  bankName?: string | null;
  bankCode?: string | null;
  bankAgency?: string | null;
  bankAccount?: string | null;
  bankAccountType?: 'checking' | 'savings' | null;
  bankHolderName?: string | null;
  bankHolderCpf?: string | null;
  pixKey?: string | null;
  pixKeyType?: 'cpf' | 'email' | 'phone' | 'random' | null;
}

const resellerService = {
  getProfile: async (): Promise<ResellerProfileResponse> => {
    const response = await api.get<ResellerProfileResponse>('/resellers/profile');
    return response.data;
  },

  updateProfile: async (
    payload: UpdateResellerProfilePayload,
  ): Promise<ResellerProfileResponse> => {
    const response = await api.patch<ResellerProfileResponse>('/resellers/profile', payload);
    return response.data;
  },

  updateBankInfo: async (
    payload: UpdateResellerBankInfoPayload,
  ): Promise<ResellerProfileResponse> => {
    const response = await api.patch<ResellerProfileResponse>('/resellers/bank-info', payload);
    return response.data;
  },
};

export default resellerService;
