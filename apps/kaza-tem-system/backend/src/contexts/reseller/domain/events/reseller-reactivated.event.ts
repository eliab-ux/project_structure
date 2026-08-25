import { DomainEvent } from '@gitspread/domain-primitives';

export class ResellerReactivatedEvent extends DomainEvent {
  constructor(
    public readonly resellerId: string,
    public readonly reactivatedBy: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'reseller.reactivated';
  }
}
