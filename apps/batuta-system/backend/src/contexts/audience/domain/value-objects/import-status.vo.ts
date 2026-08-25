/**
 * Lifecycle of an import. Not in §4 — added because §6.1 item 7 requires the import to run as a
 * BullMQ job "com progresso", and progress needs somewhere to live.
 */
export enum ImportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  /** Parsing failed, or no eligible channel existed to allocate to (§6.2). */
  FAILED = 'FAILED',
}
