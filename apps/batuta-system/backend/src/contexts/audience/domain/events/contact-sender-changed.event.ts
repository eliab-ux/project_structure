import { DomainEvent } from '@gitspread/domain-primitives';

/** Emitted only by an approved migration — the single path that changes a sender (6.4). */
export class ContactSenderChangedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly contactId: string,
    public readonly fromChannelId: string,
    public readonly toChannelId: string,
    public readonly migrationId: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'contact.sender_changed';
  }
}
