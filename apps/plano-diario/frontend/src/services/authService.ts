import api, { clearSession, storeSession } from 'src/services/api';
import { AuthSession, User } from 'src/types';

async function login(email: string, password: string): Promise<AuthSession> {
  const { data } = await api.post<AuthSession>('/auth/login', { email, password });
  storeSession(data.accessToken, data.refreshToken);
  return data;
}

async function register(
  name: string,
  email: string,
  password: string,
  phone: string,
): Promise<User> {
  const { data } = await api.post<User>('/auth/register', { name, email, password, phone });
  return data;
}

async function me(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

async function updatePhone(phone: string): Promise<User> {
  const { data } = await api.patch<User>('/auth/me/phone', { phone });
  return data;
}

/**
 * A resposta é sempre a mesma, exista a conta ou não — é assim de propósito no backend, para
 * que a tela não sirva de verificador de e-mails cadastrados.
 */
async function forgotPassword(email: string): Promise<string> {
  const { data } = await api.post<{ message: string }>('/auth/forgot-password', { email });
  return data.message;
}

async function resetPassword(email: string, code: string, newPassword: string): Promise<string> {
  const { data } = await api.post<{ message: string }>('/auth/reset-password', {
    email,
    code,
    newPassword,
  });
  return data.message;
}

function logout(): void {
  clearSession();
}

const authService = {
  login,
  register,
  me,
  updatePhone,
  forgotPassword,
  resetPassword,
  logout,
};
export default authService;
