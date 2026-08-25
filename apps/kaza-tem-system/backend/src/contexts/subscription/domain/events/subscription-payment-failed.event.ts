import { DomainEvent } from '@gitspread/domain-primitives';

export class SubscriptionPaymentFailedEvent extends DomainEvent {
  constructor(
    public readonly subscriptionId: string,
    public readonly resellerId: string,
    public readonly attemptedAt: Date,
  ) {
    super();
  }

  get eventName(): string {
    return 'subscription.payment_failed';
  }
}
