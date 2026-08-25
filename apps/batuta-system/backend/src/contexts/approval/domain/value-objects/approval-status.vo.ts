/**
 * Lifecycle of one approval request (§4).
 *
 * `INVALIDATED` is the interesting one: it is what an edit does to a pending or granted approval
 * (§8.5). It is NOT a rejection — nobody said no; the thing that was reviewed simply stopped existing.
 * Keeping them distinct matters for the trail: "rejeitado por Ana" and "invalidado por edição" are
 * different facts.
 */
export enum ApprovalRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  /** TTL ran out before anyone decided. */
  EXPIRED = 'EXPIRED',
  /** The content changed underneath it (§8.5). */
  INVALIDATED = 'INVALIDATED',
}

/** A request that can still be decided. */
export function isOpen(status: ApprovalRequestStatus): boolean {
  return status === ApprovalRequestStatus.PENDING;
}

/** A request that already produced a human decision — the only ones that count towards approval. */
export function isDecided(status: ApprovalRequestStatus): boolean {
  return status === ApprovalRequestStatus.APPROVED || status === ApprovalRequestStatus.REJECTED;
}
