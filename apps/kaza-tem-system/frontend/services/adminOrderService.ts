import { adminFetch } from './adminApi';

export interface AdminOrderSummary {
  id: string;
  resellerId: string | null;
  status: string;
  total: number;
  createdAt: string;
  updatedAt: string;
  paymentId: string | null;
  paymentMethod: string | null;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  subtotal: number;
  shippingCost: number;
  discount: number;
  shippingAddress: {
    street: string;
    number: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    complement?: string | null;
  };
  shippingMethod: string | null;
  trackingCode: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  canceledAt: string | null;
  cancelReason: string | null;
  notes: string | null;
  items: {
    id: string;
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    createdAt: string;
  }[];
}

export async function listAdminOrders(
  token: string,
  params?: { status?: string; limit?: number; offset?: number },
): Promise<AdminOrderDetail[]> {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.offset) query.append('offset', String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return adminFetch<AdminOrderDetail[]>(token, `/admin/orders${suffix}`);
}

export async function refundOrder(
  token: string,
  orderId: string,
  data?: { amount?: number; reason?: string },
) {
  return adminFetch<void>(token, `/admin/orders/${orderId}/refund`, {
    method: 'POST',
    body: JSON.stringify({
      amount: data?.amount,
      reason: data?.reason,
    }),
  });
}

export async function getOrderDetail(token: string, orderId: string): Promise<AdminOrderDetail> {
  return adminFetch<AdminOrderDetail>(token, `/orders/${orderId}`);
}
