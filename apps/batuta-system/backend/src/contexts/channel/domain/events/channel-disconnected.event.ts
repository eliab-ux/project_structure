import { DomainEvent } from '@gitspread/domain-primitives';

/** Transient by definition — nothing subscribing to this may migrate contacts. */
export class ChannelDisconnectedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly channelId: string,
    public readonly reason: string | null,
  ) {
    super();
  }

  get eventName(): string {
    return 'channel.disconnected';
  }
}
