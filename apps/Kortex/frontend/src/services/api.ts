import axios, { AxiosError, AxiosRequestConfig } from 'axios';

export const ACCESS_TOKEN_KEY = 'kortex_access_token';
export const REFRESH_TOKEN_KEY = 'kortex_refresh_token';
export const USER_KEY = 'kortex_user';

/**
 * `/api` relativo por padrão: em produção frontend e backend dividem um domínio (o Traefik roteia
 * /api para o backend), então nenhum build arg é necessário. Sobrescreva com NEXT_PUBLIC_API_URL
 * quando estiverem em hosts diferentes — o caso do desenvolvimento local.
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

// Injeta o access token em toda requisição (obrigatório — CLAUDE.md, frontend §1).
api.interceptors.request.use((config) => {
  const token = getStoredToken(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Refresh-on-401, com UM refresh em voo por vez.
 *
 * O single-flight é o ponto. O access token vive 15 minutos e a tela de Configuração dispara três
 * requisições de uma vez (conta, janelas, máquinas). Sem ele, cada uma iniciaria o próprio refresh
 * e o usuário seria deslogado justamente pelo mecanismo que existe para mantê-lo dentro.
 *
 * Um refresh que falha limpa a sessão e navega para /login com recarga de página, não com o router:
 * este módulo não tem router, e a recarga também derruba qualquer estado do React que ainda
 * segurasse dado que o usuário talvez não possa mais ver.
 */
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getStoredToken(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    throw new Error('Sessão expirada.');
  }

  // Um axios cru, não o `api`: passar pela instância re-entraria neste interceptor.
  const response = await axios.post<{ accessToken: string; refreshToken: string; user: unknown }>(
    `${API_BASE_URL}/auth/refresh`,
    { refreshToken },
  );

  localStorage.setItem(ACCESS_TOKEN_KEY, response.data.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
  return response.data.accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const url = request?.url ?? '';

    // Nunca renovar o próprio refresh, nem repetir a mesma requisição duas vezes. E o 401 do
    // login é credencial errada, não sessão expirada — renovar ali esconderia o erro real.
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh');
    if (error.response?.status !== 401 || !request || request._retried || isAuthCall) {
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
 * A mensagem a mostrar ao usuário quando uma requisição falha.
 *
 * Prefere a mensagem da própria API, porque o backend as escreve para pessoas — "Reserva fora do
 * horário de funcionamento" vale mostrar literal, e trocá-la por "erro ao salvar" jogaria fora a
 * única parte útil. Erro de validação chega como array e é juntado.
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
