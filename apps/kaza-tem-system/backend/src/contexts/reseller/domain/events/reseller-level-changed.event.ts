import { DomainEvent } from '@gitspread/domain-primitives';

export class ResellerLevelChangedEvent extends DomainEvent {
  constructor(
    public readonly resellerId: string,
    public readonly previousLevel: string,
    public readonly nextLevel: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'reseller.level.changed';
  }
}
