import { DomainEvent } from '@gitspread/domain-primitives';

export class WithdrawalRequestedEvent extends DomainEvent {
  constructor(
    public readonly withdrawalId: string,
    public readonly resellerId: string,
    public readonly amount: number,
  ) {
    super();
  }

  get eventName(): string {
    return 'withdrawal.requested';
  }
}
