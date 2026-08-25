import { DomainEvent } from '@gitspread/domain-primitives';

export class SubscriptionCanceledEvent extends DomainEvent {
  constructor(
    public readonly subscriptionId: string,
    public readonly resellerId: string,
    public readonly canceledAt: Date,
  ) {
    super();
  }

  get eventName(): string {
    return 'subscription.canceled';
  }
}
