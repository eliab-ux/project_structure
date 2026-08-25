import { DomainEvent } from '@gitspread/domain-primitives';

/** The required number of approvals was reached: the content may now be distributed (1.4). */
export class ContentApprovedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly contentId: string,
    public readonly contentHash: string,
    public readonly approvalCount: number,
  ) {
    super();
  }

  get eventName(): string {
    return 'content.approved';
  }
}
