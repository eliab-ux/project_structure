import api from 'src/services/api';
import { PreOrder, SlotNotice, WaitingListEntry } from 'src/types/preOrder';
import { CustomerListItem } from 'src/types/customer';

export interface PreOrderPayload {
  customerId: string;
  fabricId: string;
  productTypeId: string;
  estimatedPieces: number;
  metersPerPiece?: number | null;
  rolls?: number | null;
  estimatedLayers?: number | null;
  estimatedLayoutType?: string | null;
  estimatedHours: number;
  notes?: string | null;
}

export interface WaitingListPayload {
  customerId: string;
  preOrderId?: string | null;
  fabricId?: string | null;
  productTypeId?: string | null;
  hoursNeeded: number;
  technicalNotes?: string | null;
  wantsEarlier?: boolean;
  desiredUntil?: string | null;
}

/** Cliente como o Modelista o recebe: quatro campos, sem CPF, CNPJ, endereço nem representante. */
export interface CustomerForModelista {
  id: string;
  tradeName: string;
  city: string;
  whatsapp: string;
  notes: string | null;
}

async function listOpenPreOrders(): Promise<PreOrder[]> {
  const response = await api.get<PreOrder[]>('/pre-orders');
  return response.data;
}

async function listAllPreOrders(): Promise<PreOrder[]> {
  const response = await api.get<PreOrder[]>('/pre-orders/all');
  return response.data;
}

async function listMyPreOrders(): Promise<PreOrder[]> {
  const response = await api.get<PreOrder[]>('/pre-orders/mine');
  return response.data;
}

async function createPreOrder(payload: PreOrderPayload): Promise<PreOrder> {
  const response = await api.post<PreOrder>('/pre-orders', payload);
  return response.data;
}

async function updatePreOrder(id: string, payload: PreOrderPayload): Promise<PreOrder> {
  const response = await api.put<PreOrder>(`/pre-orders/${id}`, payload);
  return response.data;
}

async function discardPreOrder(id: string): Promise<PreOrder> {
  const response = await api.patch<PreOrder>(`/pre-orders/${id}/discard`);
  return response.data;
}

async function listWaitingList(): Promise<WaitingListEntry[]> {
  const response = await api.get<WaitingListEntry[]>('/waiting-list');
  return response.data;
}

async function createWaitingListEntry(payload: WaitingListPayload): Promise<WaitingListEntry> {
  const response = await api.post<WaitingListEntry>('/waiting-list', payload);
  return response.data;
}

async function offerSlot(id: string): Promise<WaitingListEntry> {
  const response = await api.patch<WaitingListEntry>(`/waiting-list/${id}/offer`);
  return response.data;
}

async function registerAcceptance(id: string): Promise<WaitingListEntry> {
  const response = await api.patch<WaitingListEntry>(`/waiting-list/${id}/accept`);
  return response.data;
}

async function dropEntry(id: string): Promise<WaitingListEntry> {
  const response = await api.patch<WaitingListEntry>(`/waiting-list/${id}/drop`);
  return response.data;
}

async function listSlotNotices(): Promise<SlotNotice[]> {
  const response = await api.get<SlotNotice[]>('/slot-notices');
  return response.data;
}

/** O aviso do Modelista: "vagou horário". Não agenda nada (regra 6.3). */
async function createSlotNotice(note: string): Promise<SlotNotice> {
  const response = await api.post<SlotNotice>('/slot-notices', { note });
  return response.data;
}

async function markNoticeHandled(id: string): Promise<SlotNotice> {
  const response = await api.patch<SlotNotice>(`/slot-notices/${id}/handled`);
  return response.data;
}

/** Rota separada e DTO próprio — o Administrativo usa `/customers`, que ele não alcança. */
async function listCustomersForModelista(): Promise<CustomerForModelista[]> {
  const response = await api.get<CustomerForModelista[]>('/modelista/customers');
  return response.data;
}

async function listCustomersForAdmin(): Promise<CustomerListItem[]> {
  const response = await api.get<CustomerListItem[]>('/customers');
  return response.data;
}

const preOrderService = {
  listOpenPreOrders,
  listAllPreOrders,
  listMyPreOrders,
  createPreOrder,
  updatePreOrder,
  discardPreOrder,
  listWaitingList,
  createWaitingListEntry,
  offerSlot,
  registerAcceptance,
  dropEntry,
  listSlotNotices,
  createSlotNotice,
  markNoticeHandled,
  listCustomersForModelista,
  listCustomersForAdmin,
};
export default preOrderService;
