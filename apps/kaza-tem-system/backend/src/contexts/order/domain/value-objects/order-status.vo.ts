import { ValueObject } from '@gitspread/domain-primitives';

export type OrderStatusValue =
  | 'pending'
  | 'awaiting_payment'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'canceled';

export class OrderStatus extends ValueObject<{ value: OrderStatusValue }> {
  static readonly PENDING = new OrderStatus({ value: 'pending' });
  static readonly AWAITING_PAYMENT = new OrderStatus({ value: 'awaiting_payment' });
  static readonly PAID = new OrderStatus({ value: 'paid' });
  static readonly PROCESSING = new OrderStatus({ value: 'processing' });
  static readonly SHIPPED = new OrderStatus({ value: 'shipped' });
  static readonly DELIVERED = new OrderStatus({ value: 'delivered' });
  static readonly CANCELED = new OrderStatus({ value: 'canceled' });

  private constructor(props: { value: OrderStatusValue }) {
    super(props);
  }

  get value(): OrderStatusValue {
    return this.props.value;
  }

  canTransitionTo(newStatus: OrderStatus): boolean {
    const transitions: Record<OrderStatusValue, OrderStatusValue[]> = {
      pending: ['awaiting_payment', 'canceled'],
      awaiting_payment: ['paid', 'canceled'],
      paid: ['processing', 'canceled'],
      processing: ['shipped', 'canceled'],
      shipped: ['delivered'],
      delivered: [],
      canceled: [],
    };
    return transitions[this.value].includes(newStatus.value);
  }

  canCancel(): boolean {
    return ['pending', 'awaiting_payment', 'paid', 'processing'].includes(this.value);
  }

  static from(value: OrderStatusValue | string): OrderStatus {
    const map: Record<OrderStatusValue, OrderStatus> = {
      pending: OrderStatus.PENDING,
      awaiting_payment: OrderStatus.AWAITING_PAYMENT,
      paid: OrderStatus.PAID,
      processing: OrderStatus.PROCESSING,
      shipped: OrderStatus.SHIPPED,
      delivered: OrderStatus.DELIVERED,
      canceled: OrderStatus.CANCELED,
    } as const;

    const normalized = value as OrderStatusValue;
    const status = map[normalized];
    if (!status) {
      throw new Error(`Invalid order status: ${value}`);
    }

    return status;
  }
}
