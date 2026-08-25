import { DomainEvent } from '@gitspread/domain-primitives';

export class ConnectionEstablishedEvent extends DomainEvent {
  constructor(
    public readonly connectionId: string,
    public readonly ownerId: string,
    public readonly igUserId: string,
    public readonly username: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'connection.established';
  }
}
