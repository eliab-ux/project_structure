import { PaginatedResult, PaginationParams } from '@gitspread/shared-kernel';
import { Distribution } from '../../../domain/entities/distribution.entity';
import { Dispatch } from '../../../domain/entities/dispatch.entity';
import { DistributionStatus } from '../../../domain/value-objects/distribution-status.vo';
import { BlockedReason, DispatchStatus } from '../../../domain/value-objects/dispatch-status.vo';

export const DISTRIBUTION_REPOSITORY = Symbol('DISTRIBUTION_REPOSITORY');
export const DISPATCH_REPOSITORY = Symbol('DISPATCH_REPOSITORY');
export const DISPATCH_QUEUE = Symbol('DISPATCH_QUEUE');

export interface ListDistributionsFilter extends PaginationParams {
  status?: DistributionStatus;
  contentId?: string;
}

export interface DistributionRepositoryPort {
  findById(id: string): Promise<Distribution | null>;
  list(filter: ListDistributionsFilter): Promise<PaginatedResult<Distribution>>;
  save(distribution: Distribution): Promise<Distribution>;
  /** Distributions with pending work, for the completion sweep. Ids only — the job re-reads scoped. */
  listActiveIds(): Promise<{ distributionId: string; accountId: string }[]>;
}

/** Aggregate counts of a distribution, for the tracking screen and the completion check. */
export interface DispatchCounts {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  cancelled: number;
  blocked: number;
}

export interface DispatchesByChannel {
  channelId: string;
  scheduled: number;
  sent: number;
  failed: number;
}

export interface BlockedSummary {
  reason: BlockedReason;
  count: number;
}

export interface DispatchRepositoryPort {
  findById(id: string): Promise<Dispatch | null>;
  /** Batch insert of a whole plan: one statement per chunk, not one per contact. */
  saveMany(dispatches: readonly Dispatch[]): Promise<void>;
  save(dispatch: Dispatch): Promise<Dispatch>;
  countsFor(distributionId: string): Promise<DispatchCounts>;
  /**
   * When the next still-pending send is due, or null when nothing is pending.
   *
   * It exists because the counts alone cannot answer the question an operator actually asks of a
   * campaign that shows PLANNED and zero sent: *when does it start?* The answer is already in the
   * rows — `scheduled_at` was frozen at planning time — and without surfacing it the only way to tell
   * "tomorrow at 08:00 because the chip's daily allowance is spent" from "something is broken" is to
   * read the database.
   */
  nextPendingAt(distributionId: string): Promise<Date | null>;
  byChannelFor(distributionId: string): Promise<DispatchesByChannel[]>;
  blockedSummaryFor(distributionId: string): Promise<BlockedSummary[]>;
  listForDistribution(
    distributionId: string,
    filter: PaginationParams & { status?: DispatchStatus },
  ): Promise<PaginatedResult<Dispatch>>;
  /** Cancels everything not yet sent. Returns how many rows changed. */
  cancelPendingFor(distributionId: string): Promise<number>;

  /**
   * Claims one due dispatch for a worker (§10, FASE 7 item 3).
   *
   * `SELECT ... FOR UPDATE SKIP LOCKED` is the whole reason this is a repository method and not a
   * find-then-save in a use case: the read and the claim have to be one atomic step, or two workers
   * read the same PENDING row and the contact receives the message twice.
   */
  claimDue(input: {
    /**
     * From the JOB PAYLOAD, never inferred. Raw SQL does not see the global tenant filter, so the
     * scope has to be written into the WHERE clause by hand — same rule the ScopedRawQueryService
     * enforces for metrics.
     */
    accountId: string;
    dispatchId: string;
  }): Promise<Dispatch | null>;

  /**
   * Looks a dispatch up by the provider's message id, for a delivery ack (§2.1: `delivery_rate`).
   *
   * Tenant-scoped like everything else: the webhook resolves the account from the instance name before
   * this is called, so the ack of one tenant can never touch another's row.
   */
  findByProviderMessageId(providerMessageId: string): Promise<Dispatch | null>;

  /** Pending dispatches of a channel, for the migration re-point of §6.4 item 5. */
  listPendingForChannel(channelId: string): Promise<Dispatch[]>;
  /** Re-points pending dispatches to new channels in one statement per channel. */
  reassignPending(input: {
    fromChannelId: string;
    reassignments: ReadonlyMap<string, string>;
  }): Promise<number>;
  /** Blocks pending dispatches that no longer have a usable sender. */
  blockPendingForChannel(channelId: string, reason: BlockedReason): Promise<number>;
}

/**
 * Enqueues the execution of a plan.
 *
 * A port, and the reason matters: the distribution context decides WHEN each send should happen and
 * nothing more. Whether that becomes a BullMQ job with a delay, a cron sweep, or something else is
 * FASE 7's business. Until FASE 7 provides the real adapter, the no-op one logs and the plan simply
 * sits in `dispatches` — which is exactly the state §9.2 describes: "O plano é dado, não memória."
 */
export interface DispatchQueuePort {
  /** @returns how many jobs were enqueued. */
  enqueuePlan(input: {
    accountId: string;
    distributionId: string;
    dispatches: readonly { dispatchId: string; scheduledAt: Date }[];
    /**
     * The account timezone AS RECORDED IN THE PLAN (`distributions.config.timeZone`), not read fresh.
     *
     * It travels with the job because the worker counts quota per calendar day, and "which day" only
     * means something in a zone. Taking it from the plan's own snapshot rather than from the account
     * means editing the account's timezone mid-campaign cannot silently reinterpret sends that were
     * already scheduled under the old one.
     */
    timeZone: string;
  }): Promise<number>;
  /** Removes not-yet-run jobs of a distribution (pause and cancel). */
  removePlan(distributionId: string): Promise<number>;
}
