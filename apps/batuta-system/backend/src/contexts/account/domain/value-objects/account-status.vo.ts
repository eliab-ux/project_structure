/**
 * Lifecycle of a tenant.
 *
 * `SUSPENDED` is the important one: workers refuse to send, `RUNNING` distributions are paused
 * — but login stays allowed, because the user has to be able to read WHY they were suspended
 * (BATUTA_SPEC §5, FASE 1 item 6).
 */
export enum AccountStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

/** A tenant that may dispatch campaigns. Suspension is the only blocking state. */
export function canDispatch(status: AccountStatus): boolean {
  return status === AccountStatus.TRIAL || status === AccountStatus.ACTIVE;
}
