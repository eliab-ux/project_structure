import api from 'src/services/api';
import { Session, SessionInfo } from 'src/types';

async function create(pacienteId: string): Promise<Session> {
  const { data } = await api.post<Session>('/sessions', { pacienteId });
  return data;
}

async function getByCode(code: string): Promise<SessionInfo> {
  const { data } = await api.get<SessionInfo>(`/sessions/${code}`);
  return data;
}

async function end(code: string): Promise<void> {
  await api.post(`/sessions/${code}/end`);
}

async function getInvite(code: string): Promise<{ sessionCode: string; hash: string }> {
  const { data } = await api.get<{ sessionCode: string; hash: string }>(`/sessions/${code}/invite`);
  return data;
}

async function sendLink(
  pacienteId: string,
  channel: 'whatsapp' | 'email',
): Promise<{ link: string; sessionCode: string; channel: string }> {
  const { data } = await api.post('/sessions/send-link', { pacienteId, channel });
  return data;
}

const sessionService = { create, getByCode, end, getInvite, sendLink };
export default sessionService;
