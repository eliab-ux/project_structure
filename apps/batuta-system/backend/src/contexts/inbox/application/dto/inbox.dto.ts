import { Conversation } from '../../domain/entities/conversation.entity';
import { Message } from '../../domain/entities/message.entity';
import { QuickReply } from '../../domain/entities/quick-reply.entity';
import {
  ConversationPriority,
  ConversationStatus,
  MessageDirection,
} from '../../domain/value-objects/conversation-status.vo';
import { IntentClass } from '../../domain/value-objects/intent-class.vo';
import { MessageKind } from '../../domain/value-objects/message-kind.vo';

export class MessageDto {
  id!: string;
  direction!: MessageDirection;
  kind!: MessageKind;
  body!: string | null;
  /** Signed, short-lived. Null when there is no media or the storage is unreachable. */
  mediaUrl!: string | null;
  /** Set for a reply, null for inbound and for campaign messages. */
  sentBy!: string | null;
  /** Set when this message came from a distribution — the thread shows what started it. */
  dispatchId!: string | null;
  deliveryStatus!: string | null;
  occurredAt!: Date;

  static from(message: Message, mediaUrl: string | null): MessageDto {
    const dto = new MessageDto();
    dto.id = message.id;
    dto.direction = message.direction;
    dto.kind = message.kind;
    dto.body = message.body;
    dto.mediaUrl = mediaUrl;
    dto.sentBy = message.sentBy;
    dto.dispatchId = message.dispatchId;
    dto.deliveryStatus = message.deliveryStatus;
    dto.occurredAt = message.occurredAt;
    // `providerMessageId` is not exposed: it is an internal correlation key, not information an
    // operator can act on.
    return dto;
  }
}

/** One line of the work queue. */
export class ConversationSummaryDto {
  id!: string;
  contactId!: string;
  contactName!: string | null;
  /** Masked. The full number is never needed to answer someone. */
  contactPhoneMasked!: string;
  status!: ConversationStatus;
  priority!: ConversationPriority;
  intentClass!: IntentClass | null;
  /** §10.3 item 2: the number that says whether the team is keeping up. */
  ageMinutes!: number;
  unreadCount!: number;
  /** Preview of the last message, so the operator can triage without opening. */
  lastMessagePreview!: string | null;
  lastMessageKind!: MessageKind | null;
  lastInboundAt!: Date | null;
  /** Who holds it, and whether that lock is still alive. */
  lockedBy!: string | null;
  lockIsLive!: boolean;

  static from(params: {
    conversation: Conversation;
    contactName: string | null;
    contactPhoneMasked: string;
    lastMessage: Message | null;
    ageMinutes: number;
    lockTtlMinutes: number;
    now: Date;
  }): ConversationSummaryDto {
    const dto = new ConversationSummaryDto();
    dto.id = params.conversation.id;
    dto.contactId = params.conversation.contactId;
    dto.contactName = params.contactName;
    dto.contactPhoneMasked = params.contactPhoneMasked;
    dto.status = params.conversation.status;
    dto.priority = params.conversation.priority;
    dto.intentClass = params.conversation.intentClass;
    dto.ageMinutes = params.ageMinutes;
    dto.unreadCount = params.conversation.unreadCount;
    dto.lastMessagePreview = params.lastMessage?.body?.slice(0, 140) ?? null;
    dto.lastMessageKind = params.lastMessage?.kind ?? null;
    dto.lastInboundAt = params.conversation.lastInboundAt;
    dto.lockedBy = params.conversation.lockedBy;
    dto.lockIsLive =
      params.conversation.lockedBy !== null &&
      !params.conversation.isLockExpired(params.lockTtlMinutes, params.now);
    return dto;
  }
}

/** One item, open. Everything the operator needs and nothing else. */
export class ConversationDetailDto {
  id!: string;
  contactId!: string;
  contactName!: string | null;
  contactPhoneMasked!: string;
  contactTags!: string[];
  /** Which chip received it (§10.1) — the operator does not choose it, but should see it. */
  channelLabel!: string;
  status!: ConversationStatus;
  priority!: ConversationPriority;
  intentClass!: IntentClass | null;
  ageMinutes!: number;
  lockedBy!: string | null;
  /** Full history, oldest first. */
  messages!: MessageDto[];

  static from(params: {
    conversation: Conversation;
    contactName: string | null;
    contactPhoneMasked: string;
    contactTags: readonly string[];
    channelLabel: string;
    messages: MessageDto[];
    ageMinutes: number;
  }): ConversationDetailDto {
    const dto = new ConversationDetailDto();
    dto.id = params.conversation.id;
    dto.contactId = params.conversation.contactId;
    dto.contactName = params.contactName;
    dto.contactPhoneMasked = params.contactPhoneMasked;
    dto.contactTags = [...params.contactTags];
    dto.channelLabel = params.channelLabel;
    dto.status = params.conversation.status;
    dto.priority = params.conversation.priority;
    dto.intentClass = params.conversation.intentClass;
    dto.ageMinutes = params.ageMinutes;
    dto.lockedBy = params.conversation.lockedBy;
    dto.messages = params.messages;
    return dto;
  }
}

export class InboxCountersDto {
  pendingReply!: number;
  inProgress!: number;
  highPriority!: number;
  averageAgeMinutes!: number;
  oldestAgeMinutes!: number;
}

export class QuickReplyDto {
  id!: string;
  title!: string;
  body!: string;
  tags!: string[];
  usageCount!: number;
  createdAt!: Date;

  static fromDomain(quickReply: QuickReply): QuickReplyDto {
    const dto = new QuickReplyDto();
    dto.id = quickReply.id;
    dto.title = quickReply.title;
    dto.body = quickReply.body;
    dto.tags = [...quickReply.tags];
    dto.usageCount = quickReply.usageCount;
    dto.createdAt = quickReply.createdAt;
    return dto;
  }
}
