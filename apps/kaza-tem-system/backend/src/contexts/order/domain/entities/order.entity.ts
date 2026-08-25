import { AggregateRoot } from '@gitspread/domain-primitives';
import { OrderId } from '../value-objects/order-id.vo';
import { OrderStatus } from '../value-objects/order-status.vo';
import { ShippingAddress } from '../value-objects/shipping-address.vo';
import { TrackingCode } from '../value-objects/tracking-code.vo';
import { OrderItem } from './order-item.entity';
import { OrderCreatedEvent } from '../events/order-created.event';
import { OrderPaidEvent } from '../events/order-paid.event';
import { OrderShippedEvent } from '../events/order-shipped.event';
import { OrderCanceledEvent } from '../events/order-canceled.event';

interface OrderProps {
  id: OrderId;
  userId: string;
  resellerId: string | null;
  items: OrderItem[];
  status: OrderStatus;
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  shippingAddress: ShippingAddress;
  shippingMethod: string | null;
  trackingCode: TrackingCode | null;
  paymentId: string | null;
  paymentMethod: string | null;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  canceledAt: Date | null;
  cancelReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Order extends AggregateRoot {
  private constructor(private readonly props: OrderProps) {
    super();
  }

  static create(props: {
    userId: string;
    resellerId?: string;
    items: {
      productId: string;
      sku: string;
      name: string;
      quantity: number;
      unitPrice: number;
    }[];
    shippingAddress: ShippingAddress;
    shippingMethod?: string;
    shippingCost?: number;
    discount?: number;
    notes?: string;
  }): Order {
    const id = OrderId.generate();
    const now = new Date();

    const orderItems = props.items.map((item) =>
      OrderItem.create({
        orderId: id.value,
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }),
    );

    const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const shippingCost = props.shippingCost ?? 0;
    const discount = props.discount ?? 0;
    const total = Number((subtotal + shippingCost - discount).toFixed(2));

    const order = new Order({
      id,
      userId: props.userId,
      resellerId: props.resellerId ?? null,
      items: orderItems,
      status: OrderStatus.PENDING,
      subtotal,
      shippingCost,
      discount,
      total,
      shippingAddress: props.shippingAddress,
      shippingMethod: props.shippingMethod ?? null,
      trackingCode: null,
      paymentId: null,
      paymentMethod: null,
      paidAt: null,
      shippedAt: null,
      deliveredAt: null,
      canceledAt: null,
      cancelReason: null,
      notes: props.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });

    order.addDomainEvent(new OrderCreatedEvent(id.value, props.userId, total));
    return order;
  }

  static reconstitute(props: OrderProps): Order {
    return new Order({ ...props });
  }

  get id(): OrderId {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get resellerId(): string | null {
    return this.props.resellerId;
  }

  get items(): OrderItem[] {
    return [...this.props.items];
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get subtotal(): number {
    return this.props.subtotal;
  }

  get shippingCost(): number {
    return this.props.shippingCost;
  }

  get discount(): number {
    return this.props.discount;
  }

  get total(): number {
    return this.props.total;
  }

  get shippingAddress(): ShippingAddress {
    return this.props.shippingAddress;
  }

  get shippingMethod(): string | null {
    return this.props.shippingMethod;
  }

  get trackingCode(): TrackingCode | null {
    return this.props.trackingCode;
  }

  get paymentId(): string | null {
    return this.props.paymentId;
  }

  get paymentMethod(): string | null {
    return this.props.paymentMethod;
  }

  get paidAt(): Date | null {
    return this.props.paidAt;
  }

  get shippedAt(): Date | null {
    return this.props.shippedAt;
  }

  get deliveredAt(): Date | null {
    return this.props.deliveredAt;
  }

  get canceledAt(): Date | null {
    return this.props.canceledAt;
  }

  get cancelReason(): string | null {
    return this.props.cancelReason;
  }

  get notes(): string | null {
    return this.props.notes;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  markAsPaid(paymentId: string, paymentMethod: string): void {
    if (!this.props.status.canTransitionTo(OrderStatus.PAID)) {
      throw new Error('Order cannot be marked as paid from the current status');
    }
    this.props.paymentId = paymentId;
    this.props.paymentMethod = paymentMethod;
    this.props.paidAt = new Date();
    this.props.status = OrderStatus.PAID;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new OrderPaidEvent(
        this.props.id.value,
        this.props.paymentId,
        this.props.total,
        this.props.shippingCost,
        this.props.discount,
        this.props.resellerId,
      ),
    );
  }

  markAsShipped(trackingCode: TrackingCode): void {
    if (!this.props.status.canTransitionTo(OrderStatus.SHIPPED)) {
      throw new Error('Order cannot be marked as shipped from the current status');
    }
    this.props.trackingCode = trackingCode;
    this.props.shippedAt = new Date();
    this.props.status = OrderStatus.SHIPPED;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new OrderShippedEvent(this.props.id.value, trackingCode.value));
  }

  updateStatus(newStatus: OrderStatus): void {
    if (!this.props.status.canTransitionTo(newStatus)) {
      throw new Error('Não é possível atualizar para o status desejado');
    }
    this.props.status = newStatus;
    if (newStatus === OrderStatus.DELIVERED) {
      this.props.deliveredAt = new Date();
    }
    this.props.updatedAt = new Date();
  }

  cancel(reason: string): void {
    if (!this.props.status.canCancel()) {
      throw new Error('Order cannot be canceled from the current status');
    }
    this.props.cancelReason = reason;
    this.props.canceledAt = new Date();
    this.props.status = OrderStatus.CANCELED;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new OrderCanceledEvent(this.props.id.value, reason));
  }
}
