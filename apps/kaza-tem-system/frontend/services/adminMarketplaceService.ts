import api from './api';

export interface AdminMarketplaceConfig {
  apiKey: string | null;
  hasSecret: boolean;
  webhookUrl: string | null;
  lastUsedAt: string | null;
  totalProducts: number;
}

async function getConfig(): Promise<AdminMarketplaceConfig> {
  const response = await api.get('/admin/marketplace/config');
  return response.data;
}

async function updateConfig(payload: { webhookUrl: string }) {
  const response = await api.put('/admin/marketplace/config', payload);
  return response.data;
}

async function testWebhook() {
  const response = await api.post('/admin/marketplace/test-webhook');
  return response.data;
}

async function regenerateCredentials() {
  const response = await api.post('/admin/marketplace/regenerate-credentials');
  return response.data;
}

const adminMarketplaceService = {
  getConfig,
  updateConfig,
  testWebhook,
  regenerateCredentials,
};

export default adminMarketplaceService;
