import api from './api';

export type OrderItemPayload = {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type ShippingAddressPayload = {
  street: string;
  number: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  complement?: string | null;
};

export interface CreateOrderPayload {
  userId: string;
  resellerId?: string | null;
  items: OrderItemPayload[];
  shippingAddress: ShippingAddressPayload;
  shippingMethod?: string | null;
  shippingCost?: number;
  discount?: number;
  notes?: string;
}

export interface OrderResponse {
  id: string;
  total: number;
  resellerId: string | null;
}

export interface CieloPaymentRequestPayload {
  installments: number;
  card: {
    number: string;
    holder: string;
    expirationDate: string;
    securityCode: string;
    brand: string;
  };
  customer: {
    name: string;
    email: string;
    document: string;
  };
  amount?: number;
}

export async function createOrder(payload: CreateOrderPayload): Promise<OrderResponse> {
  const response = await api.post<OrderResponse>('/orders', payload);
  return response.data;
}

export async function processPayment(orderId: string, data: CieloPaymentRequestPayload) {
  const response = await api.post(`/orders/${orderId}/pay`, data);
  return response.data;
}
