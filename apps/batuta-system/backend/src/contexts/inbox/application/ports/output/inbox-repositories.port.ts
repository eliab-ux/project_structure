import { PaginatedResult, PaginationParams } from '@gitspread/shared-kernel';
import { Conversation } from '../../../domain/entities/conversation.entity';
import { Message } from '../../../domain/entities/message.entity';
import { QuickReply } from '../../../domain/entities/quick-reply.entity';
import {
  ConversationPriority,
  ConversationStatus,
} from '../../../domain/value-objects/conversation-status.vo';
import { IntentClass } from '../../../domain/value-objects/intent-class.vo';
import { MessageKind } from '../../../domain/value-objects/message-kind.vo';

export const CONVERSATION_REPOSITORY = Symbol('CONVERSATION_REPOSITORY');
export const MESSAGE_REPOSITORY = Symbol('MESSAGE_REPOSITORY');
export const QUICK_REPLY_REPOSITORY = Symbol('QUICK_REPLY_REPOSITORY');
export const INBOUND_MEDIA_DOWNLOADER = Symbol('INBOUND_MEDIA_DOWNLOADER');

export interface ListConversationsFilter extends PaginationParams {
  status?: ConversationStatus;
  priority?: ConversationPriority;
  intentClass?: IntentClass;
  channelId?: string;
  /** Only items nobody is holding, for "give me the next pending one". */
  unlockedOnly?: boolean;
}

/** Counters for the dashboard and for the queue header. */
export interface InboxCounters {
  pendingReply: number;
  inProgress: number;
  highPriority: number;
  /** Average age in minutes of what is still open — the §11 item 3 health metric. */
  averageAgeMinutes: number;
  /** Age of the oldest open item: the number that says whether the team is keeping up. */
  oldestAgeMinutes: number;
}

export interface ConversationRepositoryPort {
  findById(id: string): Promise<Conversation | null>;
  /** One row per contact (§10.1) — this is the lookup that enforces it. */
  findByContactId(contactId: string): Promise<Conversation | null>;
  list(filter: ListConversationsFilter): Promise<PaginatedResult<Conversation>>;
  save(conversation: Conversation): Promise<Conversation>;
  counters(): Promise<InboxCounters>;
  /** Locks whose TTL expired, for the sweep that frees abandoned items. */
  listExpiredLocks(ttlMinutes: number): Promise<Conversation[]>;
  /** Open conversations of a channel, for the migration of §6.4 item 6. */
  listOpenForChannel(channelId: string): Promise<Conversation[]>;
}

export interface MessageRepositoryPort {
  save(message: Message): Promise<Message>;
  /** Full history of a conversation, oldest first (§10.1: "histórico completo"). */
  listForConversation(conversationId: string, limit: number): Promise<Message[]>;
  findByProviderMessageId(providerMessageId: string): Promise<Message | null>;
  /** Inbound count of a channel on a day, for the throttle's `inbound_rate` (§2.1). */
  countInboundForChannelAndDate(channelId: string, date: string): Promise<number>;
  /** Whether this provider message was already ingested — the idempotency check for the webhook. */
  existsByProviderMessageId(providerMessageId: string): Promise<boolean>;
}

export interface QuickReplyRepositoryPort {
  findById(id: string): Promise<QuickReply | null>;
  list(search?: string): Promise<QuickReply[]>;
  save(quickReply: QuickReply): Promise<QuickReply>;
  delete(id: string): Promise<void>;
}

export interface DownloadedMedia {
  kind: MessageKind;
  /** Key in the tenant's bucket. Null when the download failed — the message is kept regardless. */
  storageKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  /** Set when the download failed, so the operator sees why the player is empty. */
  failureReason: string | null;
}

/**
 * Fetches inbound media and stores it, IN THE ACT (§10.2 item 2).
 *
 * The spec's reason is blunt: "URLs da Evolution não são estáveis." A link recorded now and fetched
 * when an operator opens the item an hour later is a link that 404s, and the message becomes an empty
 * bubble nobody can explain. So the download happens during ingestion or not at all.
 *
 * A failure never discards the message: an audio nobody can play is still evidence that this person
 * replied, and losing it would corrupt both the conversation and the `inbound_rate` the throttle reads.
 */
export interface InboundMediaDownloaderPort {
  download(input: {
    accountId: string;
    conversationId: string;
    /** Base64 payload when Evolution embedded it, otherwise a URL to fetch. */
    base64?: string | null;
    url?: string | null;
    mimeType?: string | null;
    fileName?: string | null;
    kind: MessageKind;
  }): Promise<DownloadedMedia>;
}
