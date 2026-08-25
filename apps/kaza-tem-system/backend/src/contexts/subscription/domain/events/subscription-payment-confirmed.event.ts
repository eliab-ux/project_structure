import { DomainEvent } from '@gitspread/domain-primitives';

export class SubscriptionPaymentConfirmedEvent extends DomainEvent {
  constructor(
    public readonly subscriptionId: string,
    public readonly resellerId: string,
    public readonly billingDate: Date,
  ) {
    super();
  }

  get eventName(): string {
    return 'subscription.payment_confirmed';
  }
}
