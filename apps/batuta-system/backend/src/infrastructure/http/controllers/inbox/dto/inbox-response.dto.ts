import {
  ConversationDetailDto,
  ConversationSummaryDto,
  InboxCountersDto,
  MessageDto,
  QuickReplyDto,
} from '../../../../../contexts/inbox/application/dto/inbox.dto';
import { ReplyResultDto } from '../../../../../contexts/inbox/application/use-cases/send-reply/send-reply.use-case';

export class ConversationSummaryResponseDto {
  id!: string;
  contactId!: string;
  contactName!: string | null;
  contactPhoneMasked!: string;
  status!: string;
  priority!: string;
  intentClass!: string | null;
  /** The number that tells the team whether it is keeping up (§10.3 item 2). */
  ageMinutes!: number;
  unreadCount!: number;
  lastMessagePreview!: string | null;
  lastMessageKind!: string | null;
  lastInboundAt!: Date | null;
  /** Whether SOMEONE holds it. The operator id is not exposed to the list. */
  locked!: boolean;

  static from(dto: ConversationSummaryDto): ConversationSummaryResponseDto {
    const response = new ConversationSummaryResponseDto();
    response.id = dto.id;
    response.contactId = dto.contactId;
    response.contactName = dto.contactName;
    response.contactPhoneMasked = dto.contactPhoneMasked;
    response.status = dto.status;
    response.priority = dto.priority;
    response.intentClass = dto.intentClass;
    response.ageMinutes = dto.ageMinutes;
    response.unreadCount = dto.unreadCount;
    response.lastMessagePreview = dto.lastMessagePreview;
    response.lastMessageKind = dto.lastMessageKind;
    response.lastInboundAt = dto.lastInboundAt;
    response.locked = dto.lockIsLive;
    return response;
  }
}

export class MessageResponseDto {
  id!: string;
  direction!: string;
  kind!: string;
  body!: string | null;
  /** Signed and short-lived, so audio plays inline without a public bucket (§10.2 item 3). */
  mediaUrl!: string | null;
  sentBy!: string | null;
  fromDistribution!: boolean;
  deliveryStatus!: string | null;
  occurredAt!: Date;

  static from(dto: MessageDto): MessageResponseDto {
    const response = new MessageResponseDto();
    response.id = dto.id;
    response.direction = dto.direction;
    response.kind = dto.kind;
    response.body = dto.body;
    response.mediaUrl = dto.mediaUrl;
    response.sentBy = dto.sentBy;
    // The dispatch id itself is internal; what the operator needs is "this came from a campaign".
    response.fromDistribution = dto.dispatchId !== null;
    response.deliveryStatus = dto.deliveryStatus;
    response.occurredAt = dto.occurredAt;
    return response;
  }
}

export class ConversationDetailResponseDto {
  id!: string;
  contactId!: string;
  contactName!: string | null;
  contactPhoneMasked!: string;
  contactTags!: string[];
  /** Which chip received it — visible, not selectable (§10.4). */
  channelLabel!: string;
  status!: string;
  priority!: string;
  intentClass!: string | null;
  ageMinutes!: number;
  /** Who holds the lock — here it IS exposed, so the UI can say "you have this item". */
  lockedBy!: string | null;
  messages!: MessageResponseDto[];

  static from(dto: ConversationDetailDto): ConversationDetailResponseDto {
    const response = new ConversationDetailResponseDto();
    response.id = dto.id;
    response.contactId = dto.contactId;
    response.contactName = dto.contactName;
    response.contactPhoneMasked = dto.contactPhoneMasked;
    response.contactTags = dto.contactTags;
    response.channelLabel = dto.channelLabel;
    response.status = dto.status;
    response.priority = dto.priority;
    response.intentClass = dto.intentClass;
    response.ageMinutes = dto.ageMinutes;
    response.lockedBy = dto.lockedBy;
    response.messages = dto.messages.map((message) => MessageResponseDto.from(message));
    return response;
  }
}

export class InboxCountersResponseDto {
  pendingReply!: number;
  inProgress!: number;
  highPriority!: number;
  averageAgeMinutes!: number;
  oldestAgeMinutes!: number;

  static from(dto: InboxCountersDto): InboxCountersResponseDto {
    const response = new InboxCountersResponseDto();
    response.pendingReply = dto.pendingReply;
    response.inProgress = dto.inProgress;
    response.highPriority = dto.highPriority;
    response.averageAgeMinutes = dto.averageAgeMinutes;
    response.oldestAgeMinutes = dto.oldestAgeMinutes;
    return response;
  }
}

export class ReplyResponseDto {
  conversationId!: string;
  messageId!: string;
  /** Replies today on this chip, after this one — the reply band of the quota (§10.4). */
  replySendsToday!: number;
  sentAt!: Date;

  static from(dto: ReplyResultDto): ReplyResponseDto {
    const response = new ReplyResponseDto();
    response.conversationId = dto.conversationId;
    response.messageId = dto.messageId;
    response.replySendsToday = dto.replySendsToday;
    response.sentAt = dto.sentAt;
    // channelId is not returned: the operator does not choose the chip and does not act on its id.
    return response;
  }
}

export class QuickReplyResponseDto {
  id!: string;
  title!: string;
  body!: string;
  tags!: string[];
  usageCount!: number;
  createdAt!: Date;

  static from(dto: QuickReplyDto): QuickReplyResponseDto {
    const response = new QuickReplyResponseDto();
    response.id = dto.id;
    response.title = dto.title;
    response.body = dto.body;
    response.tags = dto.tags;
    response.usageCount = dto.usageCount;
    response.createdAt = dto.createdAt;
    return response;
  }
}
