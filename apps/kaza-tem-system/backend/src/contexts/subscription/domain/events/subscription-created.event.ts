import { DomainEvent } from '@gitspread/domain-primitives';

export class SubscriptionCreatedEvent extends DomainEvent {
  constructor(
    public readonly subscriptionId: string,
    public readonly resellerId: string,
    public readonly amount: number,
  ) {
    super();
  }

  get eventName(): string {
    return 'subscription.created';
  }
}
