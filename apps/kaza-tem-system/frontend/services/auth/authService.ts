const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export type UserRole = 'customer' | 'reseller' | 'admin';

export interface AuthUserPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface ResellerPayload {
  id: string;
  userId: string;
  uniqueLink: string;
  cpf: string;
  status: string;
  level: string;
  canSetCustomPrice: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserPayload;
  reseller?: ResellerPayload | null;
}

export interface AuthMeResponse {
  user: AuthUserPayload;
  reseller?: ResellerPayload | null;
}

export interface RegisterResellerPayload {
  email: string;
  name: string;
  cpf: string;
  password: string;
  phone?: string;
  bankName?: string;
  bankCode?: string;
  bankAgency?: string;
  bankAccount?: string;
  bankAccountType?: 'checking' | 'savings';
  bankHolderName?: string;
  bankHolderCpf?: string;
  pixKey?: string;
  pixKeyType?: 'cpf' | 'email' | 'phone' | 'random';
}

export interface ResetPasswordPayload {
  accessToken: string;
  newPassword: string;
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === 'object' && 'message' in payload
        ? (payload as { message?: string }).message
        : response.statusText;
    throw new Error(errorMessage || 'Erro ao se comunicar com o backend');
  }

  return payload as T;
}

async function login(payload: { email: string; password: string }): Promise<AuthLoginResponse> {
  return request<AuthLoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function refresh(refreshToken: string): Promise<AuthLoginResponse> {
  return request<AuthLoginResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

async function me(accessToken: string): Promise<AuthMeResponse> {
  return request<AuthMeResponse>('/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function registerReseller(payload: RegisterResellerPayload): Promise<ResellerPayload> {
  return request<ResellerPayload>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function forgotPassword(email: string): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

async function resetPassword(payload: ResetPasswordPayload): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export const authService = {
  login,
  refresh,
  me,
  registerReseller,
  forgotPassword,
  resetPassword,
};
