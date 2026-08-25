/**
 * BullMQ queue names. Prefixed with the app so a shared Redis never mixes queues from
 * different systems on the mdantas server.
 */
export const QUEUE_SMOKE_TEST = 'batuta-smoke-test';

/** Daily adaptive-throttle review, one job per channel (§2.1). */
export const QUEUE_CHANNEL_QUOTA_REVIEW = 'batuta-channel-quota-review';

/** Periodic reconciliation of channel connection state, in case a webhook was missed. */
export const QUEUE_CHANNEL_STATE_SYNC = 'batuta-channel-state-sync';

/** Contact list parsing and allocation (§6.1 item 7: never in the request). */
export const QUEUE_CONTACT_IMPORT = 'batuta-contact-import';

/**
 * One job per send (§10, FASE 7 item 1).
 *
 * Per SEND and not per distribution: the job id is the dispatch id, which is what makes reprocessing
 * idempotent, and it lets the queue hold each message with its own delay instead of one job trying to
 * pace ten thousand sends across a week inside a single execution.
 */
export const QUEUE_DISPATCH = 'batuta-dispatch';

/** Periodic sweep that closes distributions whose dispatches all reached a final state. */
export const QUEUE_DISTRIBUTION_SWEEP = 'batuta-distribution-sweep';

/** Payload of the FASE 0 smoke-test job. Carries no tenant or business data. */
export interface SmokeTestJobData {
  /** Free-form label so the operator can tell which enqueue produced the log line. */
  label: string;
}

/**
 * Every tenant-scoped job carries its accountId. It is written by code that already knew the tenant
 * and is what TenantScopedJobRunner uses to establish the scope — never inferred inside the worker.
 */
export interface ChannelJobData {
  accountId: string;
  channelId: string;
}

export interface ChannelQuotaReviewJobData extends ChannelJobData {
  /** The day being closed, in the account timezone (YYYY-MM-DD). */
  date: string;
}

/**
 * Payload of one send.
 *
 * It carries the `timeZone` rather than letting the worker look the account up for it: "which calendar
 * day is this quota counted in?" must be answered the same way at planning and at execution, and a
 * timezone edited in between should not silently reinterpret a scheduled send.
 */
export interface DispatchJobData {
  accountId: string;
  distributionId: string;
  dispatchId: string;
  timeZone: string;
}

export interface DistributionSweepJobData {
  accountId: string;
  distributionId: string;
}

export interface ContactImportJobData {
  accountId: string;
  importId: string;
  /** Column mapping chosen by the operator at upload time (§6.1 item 2). */
  mapping: { phone: string; name?: string | null; tags?: string | null };
  hasHeader: boolean;
}
