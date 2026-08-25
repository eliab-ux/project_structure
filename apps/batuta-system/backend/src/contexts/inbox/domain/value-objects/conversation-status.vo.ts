/** §4, `conversations.status`. */
export enum ConversationStatus {
  /** Someone wrote and nobody answered yet. This is what the work queue shows. */
  PENDING_REPLY = 'PENDING_REPLY',
  /** An operator has it open. Carries `locked_by` / `locked_at` (§10.3 item 1). */
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  /** Closed without a reply — what an acknowledgement becomes (§10.2 item 4). */
  ARCHIVED = 'ARCHIVED',
}

export enum ConversationPriority {
  NORMAL = 'NORMAL',
  /** Complaints (§10.2). Ordered before everything else, then by age (§10.3 item 2). */
  HIGH = 'HIGH',
}

/** Whether the conversation is waiting for a human. */
export function isOpen(status: ConversationStatus): boolean {
  return status === ConversationStatus.PENDING_REPLY || status === ConversationStatus.IN_PROGRESS;
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}
