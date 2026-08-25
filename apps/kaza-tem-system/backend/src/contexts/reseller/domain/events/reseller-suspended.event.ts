import { DomainEvent } from '@gitspread/domain-primitives';

export class ResellerSuspendedEvent extends DomainEvent {
  constructor(
    public readonly resellerId: string,
    public readonly suspendedBy: string,
    public readonly reason: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'reseller.suspended';
  }
}
