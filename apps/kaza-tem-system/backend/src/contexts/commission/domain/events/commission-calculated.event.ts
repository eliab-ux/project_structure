import { DomainEvent } from '@gitspread/domain-primitives';

export class CommissionCalculatedEvent extends DomainEvent {
  constructor(
    public readonly commissionId: string,
    public readonly resellerId: string,
    public readonly amount: number,
  ) {
    super();
  }

  get eventName(): string {
    return 'commission.calculated';
  }
}
