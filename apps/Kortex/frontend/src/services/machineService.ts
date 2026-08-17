import api from 'src/services/api';
import { Machine } from 'src/types/account';

async function list(): Promise<Machine[]> {
  const response = await api.get<Machine[]>('/machines');
  return response.data;
}

async function create(payload: {
  name: string;
  model: string | null;
  hourPriceCents: number;
}): Promise<Machine> {
  const response = await api.post<Machine>('/machines', payload);
  return response.data;
}

async function update(
  id: string,
  payload: { name: string; model: string | null; hourPriceCents: number; isActive: boolean },
): Promise<Machine> {
  const response = await api.put<Machine>(`/machines/${id}`, payload);
  return response.data;
}

const machineService = { list, create, update };
export default machineService;
