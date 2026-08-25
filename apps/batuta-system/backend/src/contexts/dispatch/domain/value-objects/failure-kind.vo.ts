/**
 * Whether a send failure is worth retrying (§10, FASE 7 item 6).
 *
 * The distinction is the whole of item 6, and getting it backwards is expensive in both directions:
 * retrying a permanent failure burns quota and reputation on a number that does not exist, while
 * giving up on a transient one silently drops a real recipient.
 */
export enum FailureKind {
  /** Network, 5xx, timeout, instance reconnecting. Retry with backoff. */
  TRANSIENT = 'TRANSIENT',
  /** Invalid JID, number not on WhatsApp. FAILED immediately, no retry, contact flagged. */
  PERMANENT = 'PERMANENT',
}
