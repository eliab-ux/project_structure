import { ChannelDaySignals } from '../../../domain/services/throttle-policy';
import { ThrottleDecision } from '../../../domain/value-objects/throttle-decision.vo';

export const CHANNEL_SIGNAL_SOURCE = Symbol('CHANNEL_SIGNAL_SOURCE');
export const CHANNEL_QUALITY_SNAPSHOT_REPOSITORY = Symbol('CHANNEL_QUALITY_SNAPSHOT_REPOSITORY');
export const CHANNEL_DAILY_COUNTER_REPOSITORY = Symbol('CHANNEL_DAILY_COUNTER_REPOSITORY');

/**
 * Reads the raw daily signals of a channel from wherever they live.
 *
 * All six are real now: sends from `channel_daily_counters`, disconnect events from the connection
 * webhook, deliveries and failures from `dispatches`, inbound from `messages`, opt-outs from
 * `contacts.opted_out_at`.
 *
 * ⚠️ The dependency this doc used to warn about DID bite, and the warning is kept as a scar rather than
 * deleted: for a while `sent_count` was real while `delivered_count` was still hardcoded to 0, so every
 * channel reported a 0% delivery rate, the policy read that as blocking, and quotas walked to the floor.
 * `minSampleForDecision` was the only thing holding it back. Anything added to `ChannelDaySignals` from
 * here on must be WRITTEN in the same release it starts being READ — a metric wired to a constant is
 * worse than a metric that is absent, because `null` reads as "unknown" and 0 reads as "catastrophe".
 */
export interface ChannelSignalSourcePort {
  /** Signals for one channel, most recent day last, covering the last `days` calendar days. */
  recentDays(channelId: string, days: number): Promise<ChannelDaySignals[]>;
  /** Signals for a single day, used when snapshotting today before resetting the counters. */
  forDate(channelId: string, date: string): Promise<ChannelDaySignals>;
}

export interface ChannelQualitySnapshotRecord extends ChannelDaySignals {
  channelId: string;
  computedQuota: number;
  decision: ThrottleDecision;
  reason: string;
}

export interface ChannelQualitySnapshotRepositoryPort {
  /** Idempotent per (channel, date): re-running the daily job updates rather than duplicating. */
  upsert(accountId: string, record: ChannelQualitySnapshotRecord): Promise<void>;
  /** Decision history for the health panel (§2.1 item 6), most recent first. */
  listForChannel(channelId: string, limit: number): Promise<ChannelQualitySnapshotRecord[]>;
}

export interface ChannelDailyCounterRepositoryPort {
  /** Sends of one channel on one day (campaign + reply). */
  findForChannelAndDate(
    channelId: string,
    date: string,
  ): Promise<{ campaignSends: number; replySends: number }>;
  /** Sends of every channel of the account on one day — what the account ceiling is measured against. */
  totalForAccountAndDate(accountId: string, date: string): Promise<number>;
  /**
   * Registers ONE campaign send and returns the resulting total, atomically (§10, FASE 7 item 5).
   *
   * One round trip, and the return value is what the caller checks the ceiling against — the spec is
   * explicit that read-add-write is forbidden here. Two workers sending at the same moment would both
   * read the same number, both write the same number, and the channel would quietly exceed its quota;
   * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` cannot produce that outcome.
   *
   * @returns the value of `campaign_sends` AFTER this increment.
   */
  incrementCampaignSend(accountId: string, channelId: string, date: string): Promise<number>;

  /**
   * Same for a reply from the inbox (§10.4). A separate counter because the reply band is
   * prioritised and must not compete with the campaign queue — mixing them into one number would
   * make a busy inbox silently eat the campaign's allowance.
   *
   * @returns the value of `reply_sends` AFTER this increment.
   */
  incrementReplySend(accountId: string, channelId: string, date: string): Promise<number>;

  /** Per-day totals of one channel over a window, for the throttle and for the panel. */
  listForChannelBetween(
    channelId: string,
    from: string,
    to: string,
  ): Promise<{ date: string; campaignSends: number; replySends: number }[]>;
}
