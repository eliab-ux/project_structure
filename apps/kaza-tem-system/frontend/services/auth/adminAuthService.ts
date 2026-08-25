const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

interface AdminLoginPayload {
  email: string;
  password: string;
}

interface AdminLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

async function login(payload: AdminLoginPayload): Promise<AdminLoginResponse> {
  const response = await fetch(`${API_BASE}/admin/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'Falha ao autenticar');
  }

  return response.json();
}

export const adminAuthService = { login };
