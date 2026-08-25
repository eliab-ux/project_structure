import { DomainEvent } from '@gitspread/domain-primitives';

/**
 * The channel was paused automatically (throttle PAUSE or circuit breaker) and needs a human.
 * The alert handler subscribes here; it must NEVER escalate to a terminal state.
 */
export class ChannelDegradedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly channelId: string,
    public readonly reason: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'channel.degraded';
  }
}
