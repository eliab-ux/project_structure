import api from 'src/services/api';
import { TeamUser } from 'src/types/user';
import { UserRole } from 'src/types/auth';

async function list(): Promise<TeamUser[]> {
  const response = await api.get<TeamUser[]>('/users');
  return response.data;
}

async function create(payload: {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  initialPassword: string;
}): Promise<TeamUser> {
  const response = await api.post<TeamUser>('/users', payload);
  return response.data;
}

async function update(
  id: string,
  payload: { name: string; email: string; phone: string; role: UserRole },
): Promise<TeamUser> {
  const response = await api.put<TeamUser>(`/users/${id}`, payload);
  return response.data;
}

/** Desligar inativa, nunca apaga: apagar quebraria a autoria do histórico (spec §4.3). */
async function setActive(id: string, isActive: boolean): Promise<TeamUser> {
  const response = await api.patch<TeamUser>(`/users/${id}/active`, { isActive });
  return response.data;
}

const userService = { list, create, update, setActive };
export default userService;
