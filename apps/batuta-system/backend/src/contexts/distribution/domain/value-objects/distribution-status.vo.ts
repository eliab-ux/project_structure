/**
 * Lifecycle of a distribution (§4).
 *
 * `DRAFT` is the planned-but-unconfirmed state, and it is not decoration: the plan is persisted as
 * `dispatches` BEFORE anyone confirms ("o plano é dado, não memória", §9.2), so there has to be a
 * state where rows exist and nothing is queued. Confirming moves it to `PLANNED`, which is the only
 * moment jobs are enqueued.
 */
export enum DistributionStatus {
  DRAFT = 'DRAFT',
  PLANNED = 'PLANNED',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Whether the distribution may still produce sends. */
export function isActive(status: DistributionStatus): boolean {
  return (
    status === DistributionStatus.PLANNED ||
    status === DistributionStatus.RUNNING ||
    status === DistributionStatus.PAUSED
  );
}

/** Terminal: nothing further will happen, and the row is kept as audit evidence (§11 item 2). */
export function isTerminal(status: DistributionStatus): boolean {
  return status === DistributionStatus.COMPLETED || status === DistributionStatus.CANCELLED;
}
