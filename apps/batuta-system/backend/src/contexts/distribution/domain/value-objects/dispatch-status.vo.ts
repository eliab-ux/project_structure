/** Lifecycle of ONE send to ONE contact (§4). */
export enum DispatchStatus {
  PENDING = 'PENDING',
  /** Claimed by a worker. The window where a crash would otherwise lose the row. */
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  /** Never attempted, and the reason is recorded — see BlockedReason. */
  BLOCKED = 'BLOCKED',
}

/**
 * Why a send will not happen (§4).
 *
 * Recorded per item rather than aggregated, because the preview has to list "BLOCKED **com motivo por
 * item**" (§9.3). "1.200 contatos bloqueados" is not actionable; "1.200 sem remetente porque o Chip 3
 * está DISCONNECTED" is.
 */
export enum BlockedReason {
  /** The contact's `current_channel_id` is missing, terminal, or not CONNECTED. No fallback (§6.3). */
  SENDER_UNAVAILABLE = 'SENDER_UNAVAILABLE',
  CONTACT_OPTED_OUT = 'CONTACT_OPTED_OUT',
  CONTACT_INACTIVE = 'CONTACT_INACTIVE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  CONTENT_NOT_APPROVED = 'CONTENT_NOT_APPROVED',
}

/** Statuses a worker may still pick up. */
export function isPending(status: DispatchStatus): boolean {
  return status === DispatchStatus.PENDING;
}

/** Nothing more will be attempted for this dispatch. */
export function isFinal(status: DispatchStatus): boolean {
  return (
    status === DispatchStatus.SENT ||
    status === DispatchStatus.FAILED ||
    status === DispatchStatus.CANCELLED ||
    status === DispatchStatus.BLOCKED
  );
}
