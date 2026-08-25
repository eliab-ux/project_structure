import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const ACCESS_TOKEN_KEY = 'ecoa_access_token';
export const REFRESH_TOKEN_KEY = 'ecoa_refresh_token';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
});

function getStored(key: string): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
}

// Inject the access token in every request.
api.interceptors.request.use((config) => {
  const token = getStored(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Transparent refresh: on a single 401, try the refresh token once, then replay the request.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getStored(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    return null;
  }
  try {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const { data } = await axios.post(`${base}/auth/refresh`, { refreshToken });
    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    return data.accessToken as string;
  } catch {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      refreshing = refreshing ?? refreshAccessToken();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
