import { DomainEvent } from '@gitspread/domain-primitives';

/** One rejection is enough (8.5). The comment is visible to the author. */
export class ContentRejectedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly contentId: string,
    public readonly approverId: string,
    public readonly comment: string | null,
  ) {
    super();
  }

  get eventName(): string {
    return 'content.rejected';
  }
}
