import { OrderItemDto } from './order-item.dto';

export interface ShippingAddressDto {
  street: string;
  number: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  complement?: string | null;
}

export interface OrderDto {
  id: string;
  userId: string;
  resellerId: string | null;
  status: string;
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  shippingAddress: ShippingAddressDto;
  shippingMethod: string | null;
  trackingCode: string | null;
  paymentId: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  canceledAt: string | null;
  cancelReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemDto[];
}
