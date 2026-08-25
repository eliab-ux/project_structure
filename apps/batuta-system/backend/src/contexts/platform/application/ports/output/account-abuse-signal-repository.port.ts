export const ACCOUNT_ABUSE_SIGNAL_REPOSITORY = Symbol('ACCOUNT_ABUSE_SIGNAL_REPOSITORY');

/** One persisted row of daily counters for an account. Rates are derived, never stored. */
export interface AccountAbuseSignalRecord {
  accountId: string;
  date: string;
  sentCount: number;
  failedCount: number;
  deliveredCount: number;
  optOutCount: number;
  inboundCount: number;
  previousDaySentCount: number;
}

export interface AccountAbuseSignalRepositoryPort {
  /** Idempotent per (account, date) — a re-run of the daily job must not duplicate a row. */
  upsertForDate(record: AccountAbuseSignalRecord): Promise<void>;
  /**
   * Platform read: crosses tenants by design, reachable only behind PlatformAdminGuard. Scoped
   * to one account per call so the caller always names whose data it is looking at.
   */
  findForAccountBetween(
    accountId: string,
    from: string,
    to: string,
  ): Promise<AccountAbuseSignalRecord[]>;
}
