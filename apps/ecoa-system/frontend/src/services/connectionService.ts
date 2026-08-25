import api from 'src/services/api';
import { Connection, OAuthUrl } from 'src/types';

async function getStatus(): Promise<Connection> {
  const { data } = await api.get('/connection');
  return data;
}

async function getOAuthUrl(): Promise<OAuthUrl> {
  const { data } = await api.get('/connection/oauth-url');
  return data;
}

async function completeCallback(code: string, state?: string): Promise<Connection> {
  const { data } = await api.post('/connection/callback', { code, state });
  return data;
}

async function disconnect(): Promise<void> {
  await api.delete('/connection');
}

const connectionService = { getStatus, getOAuthUrl, completeCallback, disconnect };
export default connectionService;
