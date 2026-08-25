import api from 'src/services/api';
import { GroupList, QrCode, WhatsappInstance } from 'src/types';

async function getInstance(): Promise<WhatsappInstance> {
  const { data } = await api.get<WhatsappInstance>('/whatsapp/instance');
  return data;
}

async function getStatus(): Promise<WhatsappInstance> {
  const { data } = await api.get<WhatsappInstance>('/whatsapp/instance/status');
  return data;
}

/** Cria a instância (se não existir) e devolve o QR. */
async function connect(): Promise<QrCode> {
  const { data } = await api.post<QrCode>('/whatsapp/instance');
  return data;
}

async function newQrCode(): Promise<QrCode> {
  const { data } = await api.get<QrCode>('/whatsapp/instance/qrcode');
  return data;
}

async function logout(): Promise<void> {
  await api.post('/whatsapp/instance/logout');
}

async function remove(): Promise<void> {
  await api.delete('/whatsapp/instance');
}

async function listGroups(refresh = false): Promise<GroupList> {
  const { data } = await api.get<GroupList>('/whatsapp/groups', {
    params: refresh ? { refresh: 'true' } : undefined,
  });
  return data;
}

const whatsappService = {
  getInstance,
  getStatus,
  connect,
  newQrCode,
  logout,
  remove,
  listGroups,
};
export default whatsappService;
