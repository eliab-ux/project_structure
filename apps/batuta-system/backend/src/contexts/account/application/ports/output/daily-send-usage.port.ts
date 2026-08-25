export const DAILY_SEND_USAGE = Symbol('DAILY_SEND_USAGE');

/**
 * How many messages a tenant has already sent today (campaign + replies), which is what the
 * account-wide ceiling is measured against.
 *
 * FASE 1 has no channels and no dispatches, so the only implementation answers 0. FASE 2/7
 * replaces it with a read of `channel_daily_counters` — the source of truth for quota (§4).
 * Keeping it behind a port now means the ceiling rule is written, tested and unchanged later.
 */
export interface DailySendUsagePort {
  totalSentToday(accountId: string, timezone: string): Promise<number>;
}
