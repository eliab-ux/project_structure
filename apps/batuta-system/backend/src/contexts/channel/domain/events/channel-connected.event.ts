import { DomainEvent } from '@gitspread/domain-primitives';

export class ChannelConnectedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly channelId: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'channel.connected';
  }
}
