import api from 'src/services/api';

export interface WhatsappStatus {
  configured: boolean;
  mode: 'shared' | 'own' | null;
  connected: boolean;
  qrBase64: string | null;
  canCreateOwn: boolean;
  hasShared: boolean;
}

async function status(): Promise<WhatsappStatus> {
  const { data } = await api.get<WhatsappStatus>('/whatsapp/status');
  return data;
}

async function setup(mode: 'shared' | 'own'): Promise<WhatsappStatus> {
  const { data } = await api.post<WhatsappStatus>('/whatsapp/setup', { mode });
  return data;
}

async function disconnect(): Promise<void> {
  await api.delete('/whatsapp');
}

const whatsappService = { status, setup, disconnect };
export default whatsappService;
