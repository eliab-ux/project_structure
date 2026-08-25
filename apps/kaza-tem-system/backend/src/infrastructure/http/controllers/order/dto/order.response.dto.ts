import { Order } from '../../../../../contexts/order/domain/entities/order.entity';
import { OrderItem } from '../../../../../contexts/order/domain/entities/order-item.entity';
import {
  OrderDto,
  ShippingAddressDto,
} from '../../../../../contexts/order/application/dto/order.dto';
import { OrderItemDto } from '../../../../../contexts/order/application/dto/order-item.dto';

export class OrderResponseDto implements OrderDto {
  id!: string;
  userId!: string;
  resellerId!: string | null;
  status!: string;
  subtotal!: number;
  shippingCost!: number;
  discount!: number;
  total!: number;
  shippingAddress!: ShippingAddressDto;
  shippingMethod!: string | null;
  trackingCode!: string | null;
  paymentId!: string | null;
  paymentMethod!: string | null;
  paidAt!: string | null;
  shippedAt!: string | null;
  deliveredAt!: string | null;
  canceledAt!: string | null;
  cancelReason!: string | null;
  notes!: string | null;
  createdAt!: string;
  updatedAt!: string;
  items!: OrderItemDto[];

  static from(order: Order): OrderResponseDto {
    const base: OrderResponseDto = {
      id: order.id.value,
      userId: order.userId,
      resellerId: order.resellerId,
      status: order.status.value,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      discount: order.discount,
      total: order.total,
      shippingAddress: {
        street: order.shippingAddress.street,
        number: order.shippingAddress.number,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        zipCode: order.shippingAddress.zipCode,
        country: order.shippingAddress.country,
        complement: order.shippingAddress.complement ?? null,
      },
      shippingMethod: order.shippingMethod,
      trackingCode: order.trackingCode?.value ?? null,
      paymentId: order.paymentId,
      paymentMethod: order.paymentMethod,
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
      shippedAt: order.shippedAt ? order.shippedAt.toISOString() : null,
      deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
      canceledAt: order.canceledAt ? order.canceledAt.toISOString() : null,
      cancelReason: order.cancelReason,
      notes: order.notes,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map<OrderItemDto>((item: OrderItem) => ({
        id: item.id,
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        createdAt: item.createdAt.toISOString(),
      })),
    };

    return base;
  }
}
