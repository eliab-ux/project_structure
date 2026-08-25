import { DomainEvent } from '@gitspread/domain-primitives';

export class OrderCanceledEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly reason: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'order.canceled';
  }
}
