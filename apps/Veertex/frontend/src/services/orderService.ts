import api from 'src/services/api';
import { CreateOrderPayload, ListOrdersParams, Order, UpdateOrderPayload } from 'src/types/order';

async function list(params: ListOrdersParams): Promise<Order[]> {
  const response = await api.get<Order[]>('/orders', { params });
  return response.data;
}

async function get(id: string): Promise<Order> {
  const response = await api.get<Order>(`/orders/${id}`);
  return response.data;
}

async function create(payload: CreateOrderPayload): Promise<Order> {
  const response = await api.post<Order>('/orders', payload);
  return response.data;
}

async function update(id: string, payload: UpdateOrderPayload): Promise<Order> {
  const response = await api.patch<Order>(`/orders/${id}`, payload);
  return response.data;
}

/** Ações de situação — cada uma é uma rota própria (§3.2 / §3.8). */
async function quote(id: string): Promise<Order> {
  const response = await api.post<Order>(`/orders/${id}/quote`, {});
  return response.data;
}

async function confirm(id: string): Promise<Order> {
  const response = await api.post<Order>(`/orders/${id}/confirm`, {});
  return response.data;
}

async function complete(id: string): Promise<Order> {
  const response = await api.post<Order>(`/orders/${id}/complete`, {});
  return response.data;
}

async function cancel(id: string): Promise<Order> {
  const response = await api.post<Order>(`/orders/${id}/cancel`, {});
  return response.data;
}

/** Ciclo do consignado (04 §3.1) — operações de retaguarda (rot.trip.manage). */
async function openConsignment(id: string): Promise<Order> {
  const response = await api.post<Order>(`/orders/${id}/open-consignment`, {});
  return response.data;
}

async function startSettlement(id: string): Promise<Order> {
  const response = await api.post<Order>(`/orders/${id}/start-settlement`, {});
  return response.data;
}

async function closeConsignment(
  id: string,
  soldLines?: { productId: string; quantity: number }[] | null,
): Promise<Order> {
  const response = await api.post<Order>(`/orders/${id}/close-consignment`, {
    soldLines: soldLines ?? undefined,
  });
  return response.data;
}

const orderService = {
  list,
  get,
  create,
  update,
  quote,
  confirm,
  complete,
  cancel,
  openConsignment,
  startSettlement,
  closeConsignment,
};

export default orderService;
