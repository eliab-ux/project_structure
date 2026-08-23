import { Injectable } from '@nestjs/common';
import { Order } from '../../../../contexts/order/domain/entities/order.entity';
import { OrderItem } from '../../../../contexts/order/domain/entities/order-item.entity';
import { DeliveryMode, OrderOrigin } from '../../../../contexts/order/domain/order-origin';
import { OrderStatus } from '../../../../contexts/order/domain/order-status';
import { OrderOrmEntity } from '../entities/order-orm.entity';

@Injectable()
export class OrderMapper {
  toDomain(orm: OrderOrmEntity): Order {
    const items = orm.items.getItems().map((item) =>
      OrderItem.create({
        id: item.id,
        productId: item.productId,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountPercent: Number(item.discountPercent),
        discountValue: Number(item.discountValue),
      }),
    );

    return Order.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      companyId: orm.companyId,
      contactId: orm.contactId,
      salesRepId: orm.salesRepId,
      number: orm.number,
      origin: orm.origin as OrderOrigin,
      deliveryMode: orm.deliveryMode as DeliveryMode,
      originDetail: orm.originDetail,
      tripId: orm.tripId,
      status: orm.status as OrderStatus,
      items,
      discountPercent: Number(orm.discountPercent),
      discountValue: Number(orm.discountValue),
      notes: orm.notes,
      referenceDate: orm.referenceDate,
      validUntil: orm.validUntil,
      createdAt: orm.createdAt,
    });
  }

  /** Aplica os escalares do domínio numa entidade ORM já existente (edição). */
  applyScalars(orm: OrderOrmEntity, order: Order): void {
    orm.salesRepId = order.salesRepId;
    orm.origin = order.origin;
    orm.deliveryMode = order.deliveryMode;
    orm.originDetail = order.originDetail;
    orm.tripId = order.tripId;
    orm.status = order.status;
    orm.discountPercent = order.discountPercent.toFixed(2);
    orm.discountValue = order.discountValue.toFixed(2);
    orm.notes = order.notes;
    orm.referenceDate = order.referenceDate;
    orm.validUntil = order.validUntil;
    orm.updatedAt = new Date();
  }
}
