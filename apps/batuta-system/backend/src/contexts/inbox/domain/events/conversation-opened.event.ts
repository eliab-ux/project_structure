import { DomainEvent } from '@gitspread/domain-primitives';
import { IntentClass } from '../value-objects/intent-class.vo';

export class ConversationOpenedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly conversationId: string,
    public readonly contactId: string,
    public readonly channelId: string,
    public readonly intentClass: IntentClass,
  ) {
    super();
  }

  get eventName(): string {
    return 'conversation.opened';
  }
}
