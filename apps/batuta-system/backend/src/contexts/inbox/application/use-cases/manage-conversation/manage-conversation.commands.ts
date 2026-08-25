import {
  ConversationPriority,
  ConversationStatus,
} from '../../../domain/value-objects/conversation-status.vo';
import { IntentClass } from '../../../domain/value-objects/intent-class.vo';

export class ListInboxQueueQuery {
  constructor(
    public readonly accountId: string,
    public readonly page?: number,
    public readonly limit?: number,
    public readonly status?: ConversationStatus,
    public readonly priority?: ConversationPriority,
    public readonly intentClass?: IntentClass,
    public readonly channelId?: string,
    /** "Give me the next item nobody is holding" — the queue's normal mode of use. */
    public readonly unlockedOnly?: boolean,
  ) {}
}

export class OpenConversationCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly conversationId: string,
  ) {}
}

export class ResolveConversationCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly conversationId: string,
    public readonly action: 'RESOLVE' | 'ARCHIVE' | 'RELEASE' | 'REASSIGN',
    /** Required for REASSIGN, ignored otherwise. */
    public readonly targetOperatorId: string | null,
    public readonly ip: string | null,
  ) {}
}
