import { DomainEvent } from '@gitspread/domain-primitives';

export class ResellerRejectedEvent extends DomainEvent {
  constructor(
    public readonly resellerId: string,
    public readonly rejectedBy: string | null,
    public readonly reason: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'reseller.rejected';
  }
}
