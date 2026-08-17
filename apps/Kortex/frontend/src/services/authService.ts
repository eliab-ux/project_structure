import api from 'src/services/api';
import { AuthSession, AuthenticatedUser } from 'src/types/auth';

async function login(email: string, password: string): Promise<AuthSession> {
  const response = await api.post<AuthSession>('/auth/login', { email, password });
  return response.data;
}

async function me(): Promise<AuthenticatedUser> {
  const response = await api.get<AuthenticatedUser>('/auth/me');
  return response.data;
}

async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/auth/change-password', { currentPassword, newPassword });
}

/**
 * Troca o telefone do PRÓPRIO usuário. Não há parâmetro de alvo: quem é vem do token.
 * Alterar o número de outra pessoa é exclusivo do dono e passa por `/users/:id` (spec §6.12).
 */
async function changeOwnPhone(phone: string): Promise<{ phone: string }> {
  const response = await api.patch<{ phone: string }>('/auth/me/phone', { phone });
  return response.data;
}

/**
 * Sempre 204, exista o e-mail ou não. A tela reflete isso: a mensagem de confirmação é a mesma
 * nos dois casos — se ela mudasse, esta rota viraria um verificador de quem trabalha na empresa.
 */
async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/request-password-reset', { email });
}

async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  await api.post('/auth/reset-password', { email, code, newPassword });
}

const authService = {
  login,
  me,
  changePassword,
  changeOwnPhone,
  requestPasswordReset,
  resetPassword,
};
export default authService;
