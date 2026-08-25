import { DomainEvent } from '@gitspread/domain-primitives';
import { ApprovalRequestStatus } from '../value-objects/approval-status.vo';

/**
 * One approver decided. The content-level consequence (does this reach the required count? does one
 * rejection kill it?) is computed by the use case, not here — this event is the FACT, and the fact is
 * what the audit trail needs.
 */
export class ApprovalDecidedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly contentId: string,
    public readonly requestId: string,
    public readonly approverId: string,
    public readonly decision: ApprovalRequestStatus,
    /** The exact version decided upon. */
    public readonly contentHash: string,
    public readonly comment: string | null,
  ) {
    super();
  }

  get eventName(): string {
    return 'approval.decided';
  }
}
