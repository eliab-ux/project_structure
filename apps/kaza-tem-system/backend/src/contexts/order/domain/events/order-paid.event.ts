import { DomainEvent } from '@gitspread/domain-primitives';

export class OrderPaidEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly paymentId: string | null,
    public readonly amount: number,
    public readonly shippingCost: number,
    public readonly discount: number,
    public readonly resellerId: string | null,
  ) {
    super();
  }

  get eventName(): string {
    return 'order.paid';
  }
}
