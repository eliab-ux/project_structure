import { Channel } from '../../../domain/entities/channel.entity';
import { ChannelId } from '../../../domain/value-objects/channel-id.vo';
import { ChannelStatus } from '../../../domain/value-objects/channel-status.vo';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';

export const CHANNEL_REPOSITORY = Symbol('CHANNEL_REPOSITORY');

/** Minimal identity a background job needs to establish its own tenant scope. */
export interface ChannelReviewTarget {
  channelId: string;
  accountId: string;
}

/**
 * Outcome of trying to take a channel's next send slot.
 *
 * `waitMs` is meaningful only when refused, and it is how long is left of the minimum interval — the
 * caller reschedules by exactly that, so a refused job comes back when the slot is actually free
 * instead of hammering the check.
 */
export interface SendSlotReservation {
  allowed: boolean;
  waitMs: number;
}

export interface ChannelRepositoryPort {
  /** Tenant-scoped by the global filter — a channel of another account does not exist. */
  findById(id: ChannelId): Promise<Channel | null>;
  findByPhone(phone: PhoneE164): Promise<Channel | null>;
  listByAccount(status?: ChannelStatus): Promise<Channel[]>;
  /** Channels eligible to receive newly imported contacts (§6.2, used from FASE 3). */
  listConnected(): Promise<Channel[]>;
  save(channel: Channel): Promise<Channel>;

  /**
   * Takes the channel's next send slot, atomically, or says how long is left.
   *
   * This is the runtime half of the pacing, and it exists because the planning half is only a promise.
   * The 45–120s spacing lives in the BullMQ job `delay`, computed when the plan was built; the moment
   * the worker is down — a deploy, a restart, a crash, which on Dokploy is routine — the jobs come due
   * and pile up. When it returns, they are ALL ready at once, and a serial worker drains them at one
   * or two seconds each: a hundred messages out of one chip in three minutes, which is the exact burst
   * the interval exists to prevent.
   *
   * Atomicity is the whole mechanism: a single conditional UPDATE on the channel row. Two workers
   * racing both try to update the same row, one blocks on the row lock, and when it proceeds READ
   * COMMITTED re-evaluates the WHERE against the new version — so the condition now fails and it gets
   * 0 rows. Exactly one wins, with no explicit lock to forget.
   */
  reserveSendSlot(input: {
    channelId: string;
    minIntervalSeconds: number;
  }): Promise<SendSlotReservation>;

  /**
   * Job scope, NOT request scope: the daily review runs outside any request, so there is no JWT and
   * no tenant filter in force. It returns only identities — each job then establishes the tenant
   * scope from `accountId` and re-reads the channel through the scoped `findById`.
   *
   * Returning ids instead of aggregates is deliberate: it keeps the unscoped surface as small as it
   * can be while still letting a cron reach every tenant.
   */
  listAllForDailyReview(): Promise<ChannelReviewTarget[]>;
}
