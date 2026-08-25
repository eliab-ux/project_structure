/**
 * Lifecycle of a piece of content (§4).
 *
 * The one that matters for safety is `APPROVED`: §1.4 — "Distribuição só executa sobre conteúdo
 * APPROVED" — and §8.5 — editing an approved (or pending) content invalidates the approval and sends
 * it back to `DRAFT`.
 *
 * FASE 4 owns `DRAFT`, `ARCHIVED` and the invalidation rule. The transitions into
 * `PENDING_APPROVAL` / `APPROVED` / `REJECTED` belong to the approval flow of FASE 5 — this enum
 * declares them so the column and the invalidation logic are complete, not so this phase drives them.
 */
export enum ContentStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

/**
 * Statuses whose approval state is destroyed by an edit (§8.5). `REJECTED` is not one of them: it is
 * already unusable, and editing it is exactly how an author responds to the rejection.
 */
export function editInvalidatesApproval(status: ContentStatus): boolean {
  return status === ContentStatus.APPROVED || status === ContentStatus.PENDING_APPROVAL;
}

/** Only APPROVED content may be planned or dispatched (§1.4, §9.1). */
export function isDispatchable(status: ContentStatus): boolean {
  return status === ContentStatus.APPROVED;
}

/** Archived content is read-only forever: it is history, and history does not change. */
export function isEditable(status: ContentStatus): boolean {
  return status !== ContentStatus.ARCHIVED;
}
