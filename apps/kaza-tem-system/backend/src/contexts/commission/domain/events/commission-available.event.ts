import { DomainEvent } from '@gitspread/domain-primitives';

export class CommissionAvailableEvent extends DomainEvent {
  constructor(
    public readonly commissionId: string,
    public readonly resellerId: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'commission.available';
  }
}
