import { DomainEvent } from '@gitspread/domain-primitives';

export class WithdrawalRejectedEvent extends DomainEvent {
  constructor(
    public readonly withdrawalId: string,
    public readonly resellerId: string,
    public readonly reason: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'withdrawal.rejected';
  }
}
