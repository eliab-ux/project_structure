import api from 'src/services/api';
import { Paciente } from 'src/types';

async function list(): Promise<Paciente[]> {
  const { data } = await api.get<Paciente[]>('/pacientes');
  return data;
}

async function create(input: {
  email: string;
  nome: string;
  telefone: string;
  pais?: string;
}): Promise<Paciente> {
  const { data } = await api.post<Paciente>('/pacientes', input);
  return data;
}

async function getById(id: string): Promise<Paciente> {
  const { data } = await api.get<Paciente>(`/pacientes/${id}`);
  return data;
}

async function update(
  id: string,
  input: { email: string; nome: string; telefone: string; pais?: string },
): Promise<Paciente> {
  const { data } = await api.put<Paciente>(`/pacientes/${id}`, input);
  return data;
}

async function remove(id: string): Promise<void> {
  await api.delete(`/pacientes/${id}`);
}

async function verifyHash(hash: string): Promise<{ nome: string }> {
  const { data } = await api.get<{ nome: string }>(`/pacientes/by-hash/${hash}`);
  return data;
}

/** IDs dos pacientes online agora (para o indicador 🟢 no dashboard). */
async function online(): Promise<string[]> {
  const { data } = await api.get<string[]>('/pacientes/online');
  return data;
}

const pacienteService = { list, create, getById, update, remove, verifyHash, online };
export default pacienteService;
