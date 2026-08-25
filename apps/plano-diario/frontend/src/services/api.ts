import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const ACCESS_TOKEN_KEY = 'plano_diario_access_token';
export const REFRESH_TOKEN_KEY = 'plano_diario_refresh_token';

/**
 * Base relativa `/api` por default: em produção backend e frontend ficam no mesmo domínio
 * (Dokploy + Traefik), então nada precisa ser embutido no build.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const api = axios.create({ baseURL: API_BASE_URL });

function getStored(key: string): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
}

export function storeSession(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Injeta o access token em toda requisição.
api.interceptors.request.use((config) => {
  const token = getStored(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh transparente: no primeiro 401, tenta o refresh uma vez e repete a requisição.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getStored(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    return null;
  }
  try {
    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    storeSession(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  } catch {
    clearSession();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    const isRefreshCall = original?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && original && !original._retried && !isRefreshCall) {
      original._retried = true;
      refreshing = refreshing ?? refreshAccessToken();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

/** Mensagem de erro pronta para o usuário, sem vazar detalhe técnico. */
export function errorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir a operação',
): string {
  const data = (error as AxiosError<{ message?: string | string[] }>)?.response?.data;
  const message = data?.message;
  if (Array.isArray(message)) {
    return message[0] ?? fallback;
  }
  return message ?? fallback;
}

export default api;
