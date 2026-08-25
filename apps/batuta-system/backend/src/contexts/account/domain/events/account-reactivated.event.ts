import { DomainEvent } from '@gitspread/domain-primitives';

export class AccountReactivatedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly reactivatedBy: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'account.reactivated';
  }
}
