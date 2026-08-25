import { DomainEvent } from '@gitspread/domain-primitives';

/** Terminal, human-declared. Enables sender migration for this channel contacts (FASE 3). */
export class ChannelBannedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly channelId: string,
    public readonly declaredBy: string,
    public readonly reason: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'channel.banned';
  }
}
