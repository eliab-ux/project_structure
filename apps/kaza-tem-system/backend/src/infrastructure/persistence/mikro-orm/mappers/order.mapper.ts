import { Injectable } from '@nestjs/common';
import { Order } from '../../../../contexts/order/domain/entities/order.entity';
import { OrderItem } from '../../../../contexts/order/domain/entities/order-item.entity';
import { OrderId } from '../../../../contexts/order/domain/value-objects/order-id.vo';
import {
  OrderStatus,
  OrderStatusValue,
} from '../../../../contexts/order/domain/value-objects/order-status.vo';
import { ShippingAddress } from '../../../../contexts/order/domain/value-objects/shipping-address.vo';
import { TrackingCode } from '../../../../contexts/order/domain/value-objects/tracking-code.vo';
import { OrderOrmEntity } from '../entities/order-orm.entity';
import { OrderItemOrmEntity } from '../entities/order-item-orm.entity';

@Injectable()
export class OrderMapper {
  toDomain(orm: OrderOrmEntity): Order {
    const addressPayload = orm.shippingAddress as Record<string, string>;

    const shippingAddress = ShippingAddress.create({
      street: addressPayload.street,
      number: addressPayload.number,
      city: addressPayload.city,
      state: addressPayload.state,
      zipCode: addressPayload.zipCode,
      country: addressPayload.country,
      complement: addressPayload.complement ?? null,
    });

    const items = orm.items.getItems().map((item) =>
      OrderItem.reconstitute({
        id: item.id,
        orderId: orm.id,
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        createdAt: item.createdAt,
      }),
    );

    return Order.reconstitute({
      id: OrderId.from(orm.id),
      userId: orm.userId,
      resellerId: orm.resellerId ?? null,
      items,
      status: OrderStatus.from(orm.status as OrderStatusValue),
      subtotal: Number(orm.subtotal),
      shippingCost: Number(orm.shippingCost),
      discount: Number(orm.discount ?? 0),
      total: Number(orm.total),
      shippingAddress,
      shippingMethod: orm.shippingMethod ?? null,
      trackingCode: orm.trackingCode ? TrackingCode.from(orm.trackingCode) : null,
      paymentId: orm.paymentId ?? null,
      paymentMethod: orm.paymentMethod ?? null,
      paidAt: orm.paidAt ?? null,
      shippedAt: orm.shippedAt ?? null,
      deliveredAt: orm.deliveredAt ?? null,
      canceledAt: orm.canceledAt ?? null,
      cancelReason: orm.cancelReason ?? null,
      notes: orm.notes ?? null,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(domain: Order): OrderOrmEntity {
    const orm = new OrderOrmEntity();
    orm.id = domain.id.value;
    orm.userId = domain.userId;
    orm.resellerId = domain.resellerId ?? undefined;
    orm.status = domain.status.value;
    orm.subtotal = domain.subtotal;
    orm.shippingCost = domain.shippingCost;
    orm.discount = domain.discount;
    orm.total = domain.total;
    orm.shippingMethod = domain.shippingMethod ?? undefined;
    orm.shippingAddress = {
      street: domain.shippingAddress.street,
      number: domain.shippingAddress.number,
      city: domain.shippingAddress.city,
      state: domain.shippingAddress.state,
      zipCode: domain.shippingAddress.zipCode,
      country: domain.shippingAddress.country,
      complement: domain.shippingAddress.complement ?? null,
    } satisfies Record<string, string | null>;
    orm.trackingCode = domain.trackingCode?.value;
    orm.paymentId = domain.paymentId ?? undefined;
    orm.paymentMethod = domain.paymentMethod ?? undefined;
    orm.paidAt = domain.paidAt ?? undefined;
    orm.shippedAt = domain.shippedAt ?? undefined;
    orm.deliveredAt = domain.deliveredAt ?? undefined;
    orm.canceledAt = domain.canceledAt ?? undefined;
    orm.cancelReason = domain.cancelReason ?? undefined;
    orm.notes = domain.notes ?? undefined;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;

    const items = domain.items.map((item) => {
      const itemOrm = new OrderItemOrmEntity();
      itemOrm.id = item.id;
      itemOrm.order = orm;
      itemOrm.productId = item.productId;
      itemOrm.sku = item.sku;
      itemOrm.name = item.name;
      itemOrm.quantity = item.quantity;
      itemOrm.unitPrice = item.unitPrice;
      itemOrm.totalPrice = item.totalPrice;
      itemOrm.createdAt = item.createdAt;
      return itemOrm;
    });

    orm.items.set(items);
    return orm;
  }
}
