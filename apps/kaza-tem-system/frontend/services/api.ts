import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('kazaTemAuth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.accessToken) {
          config.headers = config.headers ?? {};
          config.headers.Authorization = `Bearer ${parsed.accessToken}`;
        }
      } catch (error) {
        console.warn('[api] failed to parse auth token', error);
      }
    }
  }
  return config;
});

export default api;
