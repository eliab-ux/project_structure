import { Order } from '../../domain/entities/order.entity';
import { OrderItem } from '../../domain/entities/order-item.entity';
import { ORDER_STATUS_LABEL, OrderStatus } from '../../domain/order-status';
import { ORDER_ORIGIN_LABEL } from '../../domain/order-origin';

export class OrderItemDto {
  productId!: string;
  description!: string;
  quantity!: number;
  unitPrice!: number;
  discountPercent!: number;
  discountValue!: number;
  netTotal!: number;

  static fromDomain(item: OrderItem): OrderItemDto {
    const dto = new OrderItemDto();
    dto.productId = item.productId;
    dto.description = item.description;
    dto.quantity = item.quantity;
    dto.unitPrice = item.unitPrice;
    dto.discountPercent = item.discountPercent;
    dto.discountValue = item.discountValue;
    dto.netTotal = item.netTotal;
    return dto;
  }
}

export class OrderDto {
  id!: string;
  companyId!: string;
  contactId!: string;
  salesRepId!: string | null;
  number!: number;
  origin!: string;
  originLabel!: string;
  status!: string;
  statusLabel!: string;
  items!: OrderItemDto[];
  discountPercent!: number;
  discountValue!: number;
  itemsTotal!: number;
  orderDiscount!: number;
  total!: number;
  notes!: string | null;
  referenceDate!: Date;
  createdAt!: Date;

  static fromDomain(order: Order): OrderDto {
    const dto = new OrderDto();
    dto.id = order.id.value;
    dto.companyId = order.companyId;
    dto.contactId = order.contactId;
    dto.salesRepId = order.salesRepId;
    dto.number = order.number;
    dto.origin = order.origin;
    dto.originLabel = ORDER_ORIGIN_LABEL[order.origin] ?? order.origin;
    dto.status = order.status;
    dto.statusLabel = ORDER_STATUS_LABEL[order.status as OrderStatus] ?? order.status;
    dto.items = order.items.map(OrderItemDto.fromDomain);
    dto.discountPercent = order.discountPercent;
    dto.discountValue = order.discountValue;
    dto.itemsTotal = order.itemsTotal;
    dto.orderDiscount = order.orderDiscount;
    dto.total = order.total;
    dto.notes = order.notes;
    dto.referenceDate = order.referenceDate;
    dto.createdAt = order.createdAt;
    return dto;
  }
}
