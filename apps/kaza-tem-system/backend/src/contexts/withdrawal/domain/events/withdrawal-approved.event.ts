import { DomainEvent } from '@gitspread/domain-primitives';

export class WithdrawalApprovedEvent extends DomainEvent {
  constructor(
    public readonly withdrawalId: string,
    public readonly resellerId: string,
    public readonly amount: number,
  ) {
    super();
  }

  get eventName(): string {
    return 'withdrawal.approved';
  }
}
