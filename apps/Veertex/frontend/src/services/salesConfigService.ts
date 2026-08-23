import api from 'src/services/api';
import {
  CommissionModelAResult,
  CommissionTier,
  CreatePriceListPayload,
  PaymentCondition,
  PaymentConditionKind,
  PriceList,
  ResolvedPrice,
  SalesTarget,
  UpdatePriceListPayload,
} from 'src/types/sales';

// ── Tabelas de preço (02A §3.2) ────────────────────────────────────────────────────────────────

async function listPriceLists(includeInactive = false): Promise<PriceList[]> {
  const response = await api.get<PriceList[]>('/price-lists', { params: { includeInactive } });
  return response.data;
}

async function createPriceList(payload: CreatePriceListPayload): Promise<PriceList> {
  const response = await api.post<PriceList>('/price-lists', payload);
  return response.data;
}

async function updatePriceList(id: string, payload: UpdatePriceListPayload): Promise<PriceList> {
  const response = await api.patch<PriceList>(`/price-lists/${id}`, payload);
  return response.data;
}

/** Resolve o preço vigente para produto+quantidade (+cliente/vendedor) — usado pelo form de pedido. */
async function resolvePrice(params: {
  productId: string;
  quantity: number;
  contactId?: string;
  salesRepId?: string;
}): Promise<ResolvedPrice> {
  const response = await api.get<ResolvedPrice>('/price-lists/resolve', { params });
  return response.data;
}

// ── Condições de pagamento (02 §3.6) ───────────────────────────────────────────────────────────

async function listPaymentConditions(includeInactive = false): Promise<PaymentCondition[]> {
  const response = await api.get<PaymentCondition[]>('/payment-conditions', {
    params: { includeInactive },
  });
  return response.data;
}

async function createPaymentCondition(payload: {
  name: string;
  kind: PaymentConditionKind;
}): Promise<PaymentCondition> {
  const response = await api.post<PaymentCondition>('/payment-conditions', payload);
  return response.data;
}

async function updatePaymentCondition(
  id: string,
  payload: { name?: string; kind?: PaymentConditionKind; active?: boolean },
): Promise<PaymentCondition> {
  const response = await api.patch<PaymentCondition>(`/payment-conditions/${id}`, payload);
  return response.data;
}

// ── Comissão modelo A (02A §2) ─────────────────────────────────────────────────────────────────

async function listCommissionTiers(): Promise<CommissionTier[]> {
  const response = await api.get<CommissionTier[]>('/commission/tiers');
  return response.data;
}

async function setCommissionTiers(tiers: CommissionTier[]): Promise<CommissionTier[]> {
  const response = await api.put<CommissionTier[]>('/commission/tiers', { tiers });
  return response.data;
}

export interface ModelBTiers {
  tiers: CommissionTier[];
  usingDefault: boolean;
}

/** Faixas do Modelo B (rota) — customizáveis por conta; o default real da operação é o seed. */
async function getModelBTiers(): Promise<ModelBTiers> {
  const response = await api.get<ModelBTiers>('/commission/b-tiers');
  return response.data;
}

async function setModelBTiers(tiers: CommissionTier[]): Promise<ModelBTiers> {
  const response = await api.put<ModelBTiers>('/commission/b-tiers', { tiers });
  return response.data;
}

async function listTargets(period: string): Promise<SalesTarget[]> {
  const response = await api.get<SalesTarget[]>('/commission/targets', { params: { period } });
  return response.data;
}

async function setTarget(payload: {
  userId: string;
  period: string;
  targetValue: number;
}): Promise<SalesTarget> {
  const response = await api.post<SalesTarget>('/commission/targets', payload);
  return response.data;
}

async function computeModelA(salesRepId: string, period: string): Promise<CommissionModelAResult> {
  const response = await api.get<CommissionModelAResult>('/commission/model-a', {
    params: { salesRepId, period },
  });
  return response.data;
}

async function generateModelAPayable(payload: {
  salesRepId: string;
  period: string;
  companyId: string;
}): Promise<CommissionModelAResult> {
  const response = await api.post<CommissionModelAResult>('/commission/model-a/payable', payload);
  return response.data;
}

const salesConfigService = {
  listPriceLists,
  createPriceList,
  updatePriceList,
  resolvePrice,
  listPaymentConditions,
  createPaymentCondition,
  updatePaymentCondition,
  listCommissionTiers,
  setCommissionTiers,
  getModelBTiers,
  setModelBTiers,
  listTargets,
  setTarget,
  computeModelA,
  generateModelAPayable,
};

export default salesConfigService;
