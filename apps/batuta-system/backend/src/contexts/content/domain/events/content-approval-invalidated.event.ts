import { DomainEvent } from '@gitspread/domain-primitives';
import { ContentStatus } from '../value-objects/content-status.vo';

/**
 * The content changed and its approval no longer applies (8.5).
 *
 * The handler that marks `approval_requests` as INVALIDATED lives in the approval context (FASE 5)
 * and subscribes here. This event exists in FASE 4 because the DETECTION is the content aggregate
 * job — it owns the hash — while the consequence belongs to whoever owns approvals.
 */
export class ContentApprovalInvalidatedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly contentId: string,
    public readonly previousHash: string,
    public readonly newHash: string,
    /** The status it was in when the edit landed: APPROVED or PENDING_APPROVAL. */
    public readonly invalidatedFrom: ContentStatus,
  ) {
    super();
  }

  get eventName(): string {
    return 'content.approval_invalidated';
  }
}
