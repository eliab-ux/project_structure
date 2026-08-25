import api, { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from 'src/services/api';
import { LoginResult, PacienteAccessResult, Psicologo } from 'src/types';

async function login(email: string, senha: string): Promise<LoginResult> {
  const { data } = await api.post<LoginResult>('/auth/login', { email, senha });
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  }
  return data;
}

async function register(input: {
  email: string;
  nome: string;
  telefone: string;
  senha: string;
  confsenha: string;
}): Promise<Psicologo> {
  const { data } = await api.post<Psicologo>('/psicologos', input);
  return data;
}

async function verifyEmail(id: string): Promise<void> {
  await api.post(`/psicologos/${id}/verify-email`);
}

async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/request-password-reset', { email });
}

async function resetPassword(code: string, senha: string): Promise<void> {
  await api.post('/auth/reset-password', { code, senha });
}

async function me(): Promise<Psicologo> {
  const { data } = await api.get<Psicologo>('/auth/me');
  return data;
}

async function pacienteSessionAccess(hash: string): Promise<PacienteAccessResult> {
  const { data } = await api.post<PacienteAccessResult>('/auth/paciente/session-access', {
    hash,
  });
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  }
  return data;
}

function logout(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

const authService = {
  login,
  register,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  me,
  pacienteSessionAccess,
  logout,
};

export default authService;
