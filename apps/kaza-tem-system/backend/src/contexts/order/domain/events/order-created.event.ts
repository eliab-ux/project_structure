import { DomainEvent } from '@gitspread/domain-primitives';

export class OrderCreatedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly total: number,
  ) {
    super();
  }

  get eventName(): string {
    return 'order.created';
  }
}
