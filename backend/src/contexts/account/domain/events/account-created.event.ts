import { DomainEvent } from '@gitspread/domain-primitives';

/**
 * A new tenant exists. Carries no personal data — a handler that needs the admin's name reads it
 * from the repository, and an event payload is a thing that ends up in logs.
 */
export class AccountCreatedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly planCode: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'account.created';
  }
}
