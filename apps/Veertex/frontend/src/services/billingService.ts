import api from 'src/services/api';

export interface BillingConfig {
  id: string;
  provider: string;
  agreementCode: string | null;
  settlementAccountId: string;
  companyId: string | null;
  active: boolean;
  /** Presente SÓ na resposta do salvar — o token não se re-exibe (hash não se inverte). */
  webhookPath: string | null;
}

export interface Charge {
  id: string;
  titleId: string;
  kind: string;
  status: string;
  provider: string;
  digitableLine: string | null;
  pixQrCode: string | null;
  pdfObjectKey: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface DunningStep {
  id: string;
  offsetDays: number;
  channel: string;
  template: string;
  mode: string;
  autoEnabledByUserId: string | null;
  autoEnabledAt: string | null;
}

export interface DunningRule {
  id: string;
  steps: DunningStep[];
  maxRebillings: number;
}

export interface DunningEvent {
  id: string;
  titleId: string;
  offsetDays: number;
  channel: string;
  renderedMessage: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

async function getConfig(): Promise<BillingConfig | null> {
  const response = await api.get<BillingConfig | null>('/billing/config');
  return response.data;
}

async function saveConfig(payload: {
  provider: string;
  credentials: string;
  agreementCode?: string | null;
  settlementAccountId: string;
  companyId?: string | null;
}): Promise<BillingConfig> {
  const response = await api.put<BillingConfig>('/billing/config', payload);
  return response.data;
}

async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const response = await api.post<{ ok: boolean; message: string }>('/billing/config/test', {});
  return response.data;
}

async function listCharges(params: { titleId?: string; status?: string } = {}): Promise<Charge[]> {
  const response = await api.get<Charge[]>('/billing/charges', { params });
  return response.data;
}

async function emitCharge(titleId: string, kind: 'boleto' | 'pix'): Promise<Charge> {
  const response = await api.post<Charge>('/billing/charges', { titleId, kind });
  return response.data;
}

async function getDunningRule(): Promise<DunningRule | null> {
  const response = await api.get<DunningRule | null>('/billing/dunning/rule');
  return response.data;
}

async function saveDunningRule(payload: {
  steps: { offsetDays: number; channel: string; template: string; mode: string }[];
  maxRebillings?: number | null;
}): Promise<DunningRule> {
  const response = await api.put<DunningRule>('/billing/dunning/rule', payload);
  return response.data;
}

async function runDunning(): Promise<{
  proposed: number;
  sent: number;
  writtenOffPending: string[];
}> {
  const response = await api.post<{
    proposed: number;
    sent: number;
    writtenOffPending: string[];
  }>('/billing/dunning/run', {});
  return response.data;
}

async function listDunningEvents(status?: string): Promise<DunningEvent[]> {
  const response = await api.get<DunningEvent[]>('/billing/dunning/events', {
    params: status ? { status } : {},
  });
  return response.data;
}

async function approveDunningEvent(id: string): Promise<{ id: string; status: string }> {
  const response = await api.post<{ id: string; status: string }>(
    `/billing/dunning/events/${id}/approve`,
    {},
  );
  return response.data;
}

async function renegotiate(payload: {
  titleIds: string[];
  installments: { amount: number; dueDate: string }[];
  description?: string | null;
}): Promise<{ renegotiatedTitleIds: string[]; newTitleIds: string[] }> {
  const response = await api.post<{ renegotiatedTitleIds: string[]; newTitleIds: string[] }>(
    '/billing/renegotiations',
    payload,
  );
  return response.data;
}

const billingService = {
  getConfig,
  saveConfig,
  testConnection,
  listCharges,
  emitCharge,
  getDunningRule,
  saveDunningRule,
  runDunning,
  listDunningEvents,
  approveDunningEvent,
  renegotiate,
};

export default billingService;
