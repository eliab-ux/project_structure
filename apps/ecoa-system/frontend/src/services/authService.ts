import api from 'src/services/api';
import { AuthTokens, AuthUser } from 'src/types';

async function login(email: string, password: string): Promise<AuthTokens> {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

async function register(name: string, email: string, password: string): Promise<AuthUser> {
  const { data } = await api.post('/auth/register', { name, email, password });
  return data;
}

async function me(): Promise<AuthUser> {
  const { data } = await api.get('/auth/me');
  return data;
}

async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/request-password-reset', { email });
}

async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post('/auth/reset-password', { token, newPassword });
}

const authService = { login, register, me, requestPasswordReset, resetPassword };
export default authService;
