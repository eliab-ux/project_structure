import api from 'src/services/api';
import { AdminUser, CreateUserPayload, UpdateUserPayload } from 'src/types/admin';

async function list(): Promise<AdminUser[]> {
  const response = await api.get<AdminUser[]>('/users');
  return response.data;
}

async function create(payload: CreateUserPayload): Promise<AdminUser> {
  const response = await api.post<AdminUser>('/users', payload);
  return response.data;
}

async function update(id: string, payload: UpdateUserPayload): Promise<AdminUser> {
  const response = await api.patch<AdminUser>(`/users/${id}`, payload);
  return response.data;
}

/** Usuário é desabilitado, nunca apagado: o histórico aponta para quem fez cada coisa. */
async function setActive(id: string, active: boolean): Promise<AdminUser> {
  const response = await api.patch<AdminUser>(`/users/${id}/status`, { active });
  return response.data;
}

const userService = { list, create, update, setActive };

export default userService;
