import { DomainEvent } from '@gitspread/domain-primitives';

export class ResellerApprovedEvent extends DomainEvent {
  constructor(
    public readonly resellerId: string,
    public readonly userId: string,
    public readonly approvedBy: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'reseller.approved';
  }
}
