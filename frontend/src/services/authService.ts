import api from 'src/services/api';
import { LoginResponse, MeResponse } from 'src/types/auth';

async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', { email, password });
  return response.data;
}

async function me(): Promise<MeResponse> {
  const response = await api.get<MeResponse>('/auth/me');
  return response.data;
}

/**
 * Always resolves for the caller's purposes: the API answers 204 whether or not the e-mail exists,
 * so the screen shows the same confirmation either way. Telling the user "esse e-mail não existe"
 * would be handing an attacker the list of registered accounts.
 */
async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/request-password-reset', { email });
}

async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  await api.post('/auth/reset-password', { email, code, newPassword });
}

async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/auth/change-password', { currentPassword, newPassword });
}

const authService = { login, me, requestPasswordReset, resetPassword, changePassword };

export default authService;
