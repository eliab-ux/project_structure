/** Espelha o `OrderDto` do backend (VND, §02). */

export type OrderStatus =
  | 'rascunho'
  | 'orcamento'
  | 'confirmado'
  | 'faturado'
  | 'concluido'
  | 'cancelado'
  | 'consignado_aberto'
  | 'em_acerto'
  | 'fechado';
export type OrderOrigin = 'erp' | 'pdv' | 'rota' | 'vitrine' | 'marketplace';
export type DeliveryMode = 'retirada' | 'envio' | 'rota_entrega';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  rascunho: 'Rascunho',
  orcamento: 'Orçamento',
  confirmado: 'Confirmado',
  faturado: 'Faturado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  consignado_aberto: 'Consignado aberto',
  em_acerto: 'Em acerto',
  fechado: 'Fechado',
};

export const ORDER_ORIGIN_LABEL: Record<OrderOrigin, string> = {
  erp: 'ERP',
  pdv: 'PDV',
  rota: 'Rota',
  vitrine: 'Vitrine',
  marketplace: 'Marketplace',
};

export const ORDER_ORIGINS: OrderOrigin[] = ['erp', 'pdv', 'rota', 'vitrine', 'marketplace'];

export const DELIVERY_MODE_LABEL: Record<DeliveryMode, string> = {
  retirada: 'Retirada',
  envio: 'Envio',
  rota_entrega: 'Entrega na rota',
};

export const DELIVERY_MODES: DeliveryMode[] = ['retirada', 'envio', 'rota_entrega'];

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
  deliveryMode: string;
  deliveryModeLabel: string;
  originDetail: string | null;
  tripId: string | null;
  paymentConditionId: string | null;
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
  validUntil: string | null;
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
  deliveryMode?: DeliveryMode;
  originDetail?: string | null;
  tripId?: string | null;
  paymentConditionId?: string | null;
  items: OrderItemPayload[];
  discountPercent?: number | null;
  discountValue?: number | null;
  notes?: string | null;
  referenceDate?: string;
  validUntil?: string;
}

export type UpdateOrderPayload = Partial<Omit<CreateOrderPayload, 'companyId' | 'contactId'>>;

export interface ListOrdersParams {
  tripId?: string;
  status?: string;
  companyId?: string;
  contactId?: string;
  salesRepId?: string;
  from?: string;
  to?: string;
  search?: string;
}
