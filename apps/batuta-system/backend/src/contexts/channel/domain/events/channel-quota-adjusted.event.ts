import { DomainEvent } from '@gitspread/domain-primitives';
import { ThrottleDecision } from '../value-objects/throttle-decision.vo';

/** Emitted whenever the daily review actually moved the quota. Feeds the health panel history. */
export class ChannelQuotaAdjustedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly channelId: string,
    public readonly decision: ThrottleDecision,
    public readonly previousQuota: number,
    public readonly newQuota: number,
    public readonly reason: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'channel.quota_adjusted';
  }
}
