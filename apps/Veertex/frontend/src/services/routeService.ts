import api from 'src/services/api';
import {
  BuildTripWalletResult,
  TripDetails,
  CargoLinePayload,
  CommercialRule,
  EffectuateFieldReceiptResult,
  ExchangeResult,
  FieldReceiptMethod,
  FieldReceiptResult,
  OrderEvidenceResult,
  PromissoryNoteResult,
  ReturnConsignedItemsResult,
  Route,
  Trip,
  TripClosureSummary,
  TripExpenseCategory,
  TripExpenseResult,
} from 'src/types/route';

// ── Rotas + Regra Comercial (04 §2/§3.7) ───────────────────────────────────────────────────────

async function listRoutes(includeInactive = false): Promise<Route[]> {
  const response = await api.get<Route[]>('/routes', { params: { includeInactive } });
  return response.data;
}

async function createRoute(payload: {
  name: string;
  code?: string | null;
  cycleDays?: number;
}): Promise<Route> {
  const response = await api.post<Route>('/routes', payload);
  return response.data;
}

async function updateRoute(
  id: string,
  payload: { name?: string; code?: string | null; cycleDays?: number; active?: boolean },
): Promise<Route> {
  const response = await api.patch<Route>(`/routes/${id}`, payload);
  return response.data;
}

async function getCommercialRule(userId: string): Promise<CommercialRule> {
  const response = await api.get<CommercialRule>(`/routes/commercial-rules/${userId}`);
  return response.data;
}

async function setCommercialRule(
  userId: string,
  payload: Omit<CommercialRule, 'userId'>,
): Promise<CommercialRule> {
  const response = await api.put<CommercialRule>(`/routes/commercial-rules/${userId}`, payload);
  return response.data;
}

// ── Viagens (04 §3) ────────────────────────────────────────────────────────────────────────────

async function listTrips(
  params: { routeId?: string; salesRepId?: string; status?: string } = {},
): Promise<Trip[]> {
  const response = await api.get<Trip[]>('/trips', { params });
  return response.data;
}

async function getTripDetails(tripId: string): Promise<TripDetails> {
  const response = await api.get<TripDetails>(`/trips/${tripId}`);
  return response.data;
}

async function createTrip(payload: {
  companyId: string;
  routeId: string;
  salesRepId: string;
  helperUserId?: string | null;
  initialCash?: number;
  initialKm?: number;
}): Promise<Trip> {
  const response = await api.post<Trip>('/trips', payload);
  return response.data;
}

async function loadCargo(
  tripId: string,
  payload: { fromLocationId: string; lines: CargoLinePayload[] },
): Promise<Trip> {
  const response = await api.post<Trip>(`/trips/${tripId}/cargo`, payload);
  return response.data;
}

async function departTrip(tripId: string): Promise<Trip> {
  const response = await api.post<Trip>(`/trips/${tripId}/depart`, {});
  return response.data;
}

async function arriveTrip(
  tripId: string,
  payload: { returnCash?: number; finalKm?: number },
): Promise<Trip> {
  const response = await api.post<Trip>(`/trips/${tripId}/arrive`, payload);
  return response.data;
}

async function cancelTrip(tripId: string): Promise<Trip> {
  const response = await api.post<Trip>(`/trips/${tripId}/cancel`, {});
  return response.data;
}

async function buildWallet(tripId: string): Promise<BuildTripWalletResult> {
  const response = await api.post<BuildTripWalletResult>(`/trips/${tripId}/wallet/build`, {});
  return response.data;
}

// ── Acerto em DOIS estágios (04 §3.3): lançar (proposta) → efetivar (baixa no FIN) ────────────

async function registerReceipt(
  tripId: string,
  payload: {
    titleId?: string | null;
    method: FieldReceiptMethod;
    amount: number;
    interest?: number;
  },
): Promise<FieldReceiptResult> {
  const response = await api.post<FieldReceiptResult>(`/trips/${tripId}/receipts`, payload);
  return response.data;
}

async function effectuateReceipt(
  receiptId: string,
  payload: { financialAccountId: string },
): Promise<EffectuateFieldReceiptResult> {
  const response = await api.post<EffectuateFieldReceiptResult>(
    `/trips/receipts/${receiptId}/effectuate`,
    payload,
  );
  return response.data;
}

async function returnItems(
  tripId: string,
  payload: { toLocationId: string; orderId?: string | null; lines: CargoLinePayload[] },
): Promise<ReturnConsignedItemsResult> {
  const response = await api.post<ReturnConsignedItemsResult>(`/trips/${tripId}/returns`, payload);
  return response.data;
}

async function exchangeItems(
  tripId: string,
  payload: {
    orderId?: string | null;
    returnedProductId: string;
    returnedQuantity: number;
    takenProductId: string;
    takenQuantity: number;
  },
): Promise<ExchangeResult> {
  const response = await api.post<ExchangeResult>(`/trips/${tripId}/exchanges`, payload);
  return response.data;
}

async function registerExpense(
  tripId: string,
  payload: {
    category: TripExpenseCategory;
    amount: number;
    note?: string | null;
    spentAt?: string;
  },
): Promise<TripExpenseResult> {
  const response = await api.post<TripExpenseResult>(`/trips/${tripId}/expenses`, payload);
  return response.data;
}

async function closeTrip(
  tripId: string,
  payload: { managerUserId?: string | null; managerPercent?: number; helperAmount?: number } = {},
): Promise<TripClosureSummary> {
  const response = await api.post<TripClosureSummary>(`/trips/${tripId}/close`, payload);
  return response.data;
}

// ── Evidências / GPS / Promissória do pedido consignado (04 §3.1) ──────────────────────────────

async function registerEvidence(
  orderId: string,
  payload: {
    type: string;
    tripId?: string | null;
    latitude?: number;
    longitude?: number;
    fileBase64?: string;
    fileMimeType?: string;
  },
): Promise<OrderEvidenceResult> {
  const response = await api.post<OrderEvidenceResult>(
    `/consignment/orders/${orderId}/evidences`,
    payload,
  );
  return response.data;
}

async function changeGps(
  orderId: string,
  payload: { latitude: number; longitude: number; reason: string },
): Promise<{ newEvidenceId: string; previousEvidenceId: string }> {
  const response = await api.post<{ newEvidenceId: string; previousEvidenceId: string }>(
    `/consignment/orders/${orderId}/gps-change`,
    payload,
  );
  return response.data;
}

async function generatePromissory(
  orderId: string,
  payload: { dueDate: string; debtorAddress?: string | null },
): Promise<PromissoryNoteResult> {
  const response = await api.post<PromissoryNoteResult>(
    `/consignment/orders/${orderId}/promissory`,
    payload,
  );
  return response.data;
}

const routeService = {
  listRoutes,
  createRoute,
  updateRoute,
  getCommercialRule,
  setCommercialRule,
  listTrips,
  getTripDetails,
  createTrip,
  loadCargo,
  departTrip,
  arriveTrip,
  cancelTrip,
  buildWallet,
  registerReceipt,
  effectuateReceipt,
  returnItems,
  exchangeItems,
  registerExpense,
  closeTrip,
  registerEvidence,
  changeGps,
  generatePromissory,
};

export default routeService;
