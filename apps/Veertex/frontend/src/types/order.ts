/** Espelha o `OrderDto` do backend (VND, §02). */

export type OrderStatus = 'rascunho' | 'confirmado' | 'faturado' | 'concluido' | 'cancelado';
export type OrderOrigin = 'balcao' | 'representante' | 'telefone' | 'importacao';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  faturado: 'Faturado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export const ORDER_ORIGIN_LABEL: Record<OrderOrigin, string> = {
  balcao: 'Balcão',
  representante: 'Representante',
  telefone: 'Telefone',
  importacao: 'Importação',
};

export const ORDER_ORIGINS: OrderOrigin[] = ['balcao', 'representante', 'telefone', 'importacao'];

export interface OrderItem {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountValue: number;
  netTotal: number;
}

export interface Order {
  id: string;
  companyId: string;
  contactId: string;
  salesRepId: string | null;
  number: number;
  origin: string;
  originLabel: string;
  status: OrderStatus;
  statusLabel: string;
  items: OrderItem[];
  discountPercent: number;
  discountValue: number;
  itemsTotal: number;
  orderDiscount: number;
  total: number;
  notes: string | null;
  referenceDate: string;
  createdAt: string;
}

export interface OrderItemPayload {
  productId: string;
  quantity: number;
  unitPrice?: number | null;
  discountPercent?: number | null;
  discountValue?: number | null;
  description?: string | null;
}

export interface CreateOrderPayload {
  companyId: string;
  contactId: string;
  salesRepId?: string | null;
  origin: OrderOrigin;
  items: OrderItemPayload[];
  discountPercent?: number | null;
  discountValue?: number | null;
  notes?: string | null;
  referenceDate?: string;
}

export type UpdateOrderPayload = Partial<Omit<CreateOrderPayload, 'companyId' | 'contactId'>>;

export interface ListOrdersParams {
  status?: string;
  companyId?: string;
  contactId?: string;
  salesRepId?: string;
  from?: string;
  to?: string;
  search?: string;
}
