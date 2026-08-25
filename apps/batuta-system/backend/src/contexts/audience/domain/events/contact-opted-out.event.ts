import { DomainEvent } from '@gitspread/domain-primitives';

/**
 * A contact asked to stop receiving. Feeds the opt_out_rate signal of the throttle (2.1) — an
 * opt-out is the most honest rejection signal a chip gets.
 */
export class ContactOptedOutEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly contactId: string,
    public readonly channelId: string,
    public readonly reason: 'MANUAL' | 'KEYWORD',
    /** User id for a manual opt-out; null when the contact themselves asked by keyword. */
    public readonly requestedBy: string | null,
  ) {
    super();
  }

  get eventName(): string {
    return 'contact.opted_out';
  }
}
