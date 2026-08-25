import { DomainEvent } from '@gitspread/domain-primitives';

export class DistributionCompletedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly distributionId: string,
    public readonly sent: number,
    public readonly failed: number,
  ) {
    super();
  }

  get eventName(): string {
    return 'distribution.completed';
  }
}
