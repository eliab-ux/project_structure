import { DomainEvent } from '@gitspread/domain-primitives';

export class OrderShippedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly trackingCode: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'order.shipped';
  }
}
