import { DomainException } from '@gitspread/domain-primitives';

export class SubscriptionNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Subscription ${id} not found`);
  }
}
