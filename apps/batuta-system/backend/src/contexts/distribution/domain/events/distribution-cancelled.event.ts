import { DomainEvent } from '@gitspread/domain-primitives';

export class DistributionCancelledEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly distributionId: string,
    public readonly reason: string | null,
  ) {
    super();
  }

  get eventName(): string {
    return 'distribution.cancelled';
  }
}
