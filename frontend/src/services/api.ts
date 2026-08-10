import axios, { AxiosError, AxiosRequestConfig } from 'axios';

export const ACCESS_TOKEN_KEY = 'veertex_access_token';
export const REFRESH_TOKEN_KEY = 'veertex_refresh_token';
export const USER_KEY = 'veertex_user';

/**
 * Relative `/api` by default: in production the frontend and the backend share one domain (Traefik
 * routes /api to the backend), so no build arg is needed. Override with NEXT_PUBLIC_API_URL when
 * they live on different hosts — which is the normal case in local development (3021 → 3020).
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const api = axios.create({ baseURL: API_BASE_URL });

export function getStoredToken(key: string): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
}

export function storeSession(accessToken: string, refreshToken: string, user: unknown): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Injects the access token in every request.
api.interceptors.request.use((config) => {
  const token = getStoredToken(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Refresh-on-401, with ONE refresh in flight at a time.
 *
 * The single-flight promise is the point. The access token lives 15 minutes and a dashboard fires
 * four or five requests at once — without it, each would start its own refresh, and all but the
 * first would present an already-rotated refresh token and be rejected. The user would be logged
 * out by the very mechanism meant to keep them in.
 *
 * A failed refresh clears the session and navigates to /login with a full page load rather than a
 * router push: this module has no router, and a hard navigation also drops any React state still
 * holding data the user may no longer be entitled to see.
 */
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getStoredToken(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    throw new Error('Sessão expirada.');
  }

  // A bare axios call, not `api`: going through the instance would re-enter this interceptor.
  const response = await axios.post<{ accessToken: string; refreshToken?: string }>(
    `${API_BASE_URL}/auth/refresh`,
    { refreshToken },
  );

  localStorage.setItem(ACCESS_TOKEN_KEY, response.data.accessToken);
  if (response.data.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refreshToken);
  }
  return response.data.accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const url = request?.url ?? '';

    // Never refresh the refresh itself, and never retry one request twice.
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh');
    if (status !== 401 || !request || request._retried || isAuthCall) {
      return Promise.reject(error);
    }

    try {
      refreshInFlight = refreshInFlight ?? refreshAccessToken();
      const token = await refreshInFlight;
      refreshInFlight = null;

      request._retried = true;
      request.headers = { ...request.headers, Authorization: `Bearer ${token}` };
      return api.request(request);
    } catch (refreshError) {
      refreshInFlight = null;
      clearSession();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    }
  },
);

/**
 * The message to show the user for a failed request.
 *
 * Prefers the API's own message: the backend writes them for people ("Seu plano permite no máximo
 * 3 empresas"), and replacing that with a generic string would throw away the only useful part.
 * Validation errors arrive as an array and are joined.
 */
export function apiErrorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir a ação.',
): string {
  const data = (error as AxiosError<{ message?: string | string[] }>)?.response?.data;
  const message = data?.message;
  if (Array.isArray(message)) {
    return message.join(' ');
  }
  return message || fallback;
}

export default api;
