import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { PaginatedResult, Pagination } from '@gitspread/shared-kernel';
import {
  ConversationRepositoryPort,
  InboxCounters,
  ListConversationsFilter,
  MessageRepositoryPort,
  QuickReplyRepositoryPort,
} from '../../../../contexts/inbox/application/ports/output/inbox-repositories.port';
import { Conversation } from '../../../../contexts/inbox/domain/entities/conversation.entity';
import { Message } from '../../../../contexts/inbox/domain/entities/message.entity';
import { QuickReply } from '../../../../contexts/inbox/domain/entities/quick-reply.entity';
import {
  ConversationStatus,
  MessageDirection,
} from '../../../../contexts/inbox/domain/value-objects/conversation-status.vo';
import { ConversationOrmEntity } from '../entities/conversation-orm.entity';
import { MessageOrmEntity } from '../entities/message-orm.entity';
import { QuickReplyOrmEntity } from '../entities/quick-reply-orm.entity';
import { ScopedRawQueryService } from '../scoped-raw-query.service';

@Injectable()
export class MikroOrmConversationRepository implements ConversationRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly raw: ScopedRawQueryService,
  ) {}

  async findById(id: string): Promise<Conversation | null> {
    const orm = await this.em.findOne(ConversationOrmEntity, { id });
    return orm ? MikroOrmConversationRepository.toDomain(orm) : null;
  }

  async findByContactId(contactId: string): Promise<Conversation | null> {
    const orm = await this.em.findOne(ConversationOrmEntity, { contactId });
    return orm ? MikroOrmConversationRepository.toDomain(orm) : null;
  }

  /**
   * The queue ordering of §10.3 item 2, done in SQL: priority first, then OLDEST first.
   *
   * `lastInboundAt` ascending is what "oldest first" means — a queue sorted newest-first is exactly how
   * items rot at the bottom, which the spec calls worse than not having the queue.
   */
  async list(filter: ListConversationsFilter): Promise<PaginatedResult<Conversation>> {
    const params = Pagination.create(filter.page, filter.limit);
    const where: Record<string, unknown> = {};

    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.priority) {
      where.priority = filter.priority;
    }
    if (filter.intentClass) {
      where.intentClass = filter.intentClass;
    }
    if (filter.channelId) {
      where.channelId = filter.channelId;
    }
    if (filter.unlockedOnly) {
      where.lockedBy = null;
    }

    const [rows, total] = await this.em.findAndCount(ConversationOrmEntity, where, {
      limit: params.limit,
      offset: (params.page - 1) * params.limit,
      orderBy: [{ priority: 'DESC' }, { lastInboundAt: 'ASC' }],
    });

    return Pagination.createResult(
      rows.map((row) => MikroOrmConversationRepository.toDomain(row)),
      total,
      params,
    );
  }

  /**
   * Queue health in one query (§11 item 3).
   *
   * Through the scoped raw service because it is an aggregate with a computed age; that service refuses
   * any SQL without `:accountId`, which makes it stricter than the ORM filter rather than a way around it.
   */
  async counters(): Promise<InboxCounters> {
    const rows = await this.raw.scoped<{
      pending_reply: string;
      in_progress: string;
      high_priority: string;
      avg_age_minutes: string | null;
      oldest_age_minutes: string | null;
    }>(
      `select
         count(*) filter (where status = 'PENDING_REPLY') as pending_reply,
         count(*) filter (where status = 'IN_PROGRESS') as in_progress,
         count(*) filter (where priority = 'HIGH' and status in ('PENDING_REPLY','IN_PROGRESS')) as high_priority,
         avg(extract(epoch from (now() - coalesce(last_inbound_at, created_at))) / 60)
           filter (where status in ('PENDING_REPLY','IN_PROGRESS')) as avg_age_minutes,
         max(extract(epoch from (now() - coalesce(last_inbound_at, created_at))) / 60)
           filter (where status in ('PENDING_REPLY','IN_PROGRESS')) as oldest_age_minutes
       from conversations
       where account_id = :accountId`,
    );

    const row = rows[0];
    return {
      pendingReply: Number(row?.pending_reply ?? 0),
      inProgress: Number(row?.in_progress ?? 0),
      highPriority: Number(row?.high_priority ?? 0),
      averageAgeMinutes: Math.round(Number(row?.avg_age_minutes ?? 0)),
      oldestAgeMinutes: Math.round(Number(row?.oldest_age_minutes ?? 0)),
    };
  }

  async listExpiredLocks(ttlMinutes: number): Promise<Conversation[]> {
    const cutoff = new Date(Date.now() - ttlMinutes * 60_000);
    const rows = await this.em.find(ConversationOrmEntity, {
      lockedBy: { $ne: null },
      lockedAt: { $lt: cutoff },
    });
    return rows.map((row) => MikroOrmConversationRepository.toDomain(row));
  }

  async listOpenForChannel(channelId: string): Promise<Conversation[]> {
    const rows = await this.em.find(ConversationOrmEntity, {
      channelId,
      status: { $in: [ConversationStatus.PENDING_REPLY, ConversationStatus.IN_PROGRESS] },
    });
    return rows.map((row) => MikroOrmConversationRepository.toDomain(row));
  }

  async save(conversation: Conversation): Promise<Conversation> {
    await this.em.upsert(ConversationOrmEntity, {
      id: conversation.id,
      accountId: conversation.accountId,
      contactId: conversation.contactId,
      channelId: conversation.channelId,
      status: conversation.status,
      priority: conversation.priority,
      intentClass: conversation.intentClass,
      lastInboundAt: conversation.lastInboundAt,
      lastOutboundAt: conversation.lastOutboundAt,
      lockedBy: conversation.lockedBy,
      lockedAt: conversation.lockedAt,
      unreadCount: conversation.unreadCount,
      resolvedBy: conversation.resolvedBy,
      resolvedAt: conversation.resolvedAt,
      createdAt: conversation.createdAt,
    });
    await this.em.flush();
    return conversation;
  }

  private static toDomain(orm: ConversationOrmEntity): Conversation {
    return Conversation.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      contactId: orm.contactId,
      channelId: orm.channelId,
      status: orm.status,
      priority: orm.priority,
      intentClass: orm.intentClass,
      lastInboundAt: orm.lastInboundAt,
      lastOutboundAt: orm.lastOutboundAt,
      lockedBy: orm.lockedBy,
      lockedAt: orm.lockedAt,
      unreadCount: orm.unreadCount,
      resolvedBy: orm.resolvedBy,
      resolvedAt: orm.resolvedAt,
      createdAt: orm.createdAt,
    });
  }
}

@Injectable()
export class MikroOrmMessageRepository implements MessageRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async save(message: Message): Promise<Message> {
    await this.em.upsert(MessageOrmEntity, {
      id: message.id,
      accountId: message.accountId,
      conversationId: message.conversationId,
      contactId: message.contactId,
      channelId: message.channelId,
      direction: message.direction,
      kind: message.kind,
      body: message.body,
      mediaStorageKey: message.mediaStorageKey,
      evolutionMessageId: message.providerMessageId,
      deliveryStatus: message.deliveryStatus,
      dispatchId: message.dispatchId,
      sentBy: message.sentBy,
      occurredAt: message.occurredAt,
      createdAt: message.createdAt,
    });
    await this.em.flush();
    return message;
  }

  async listForConversation(conversationId: string, limit: number): Promise<Message[]> {
    // Newest-first in SQL so a long thread returns its TAIL, then reversed for display: the operator
    // reads a conversation top to bottom, but the useful end of a 5-year thread is the recent one.
    const rows = await this.em.find(
      MessageOrmEntity,
      { conversationId },
      { orderBy: { occurredAt: 'DESC' }, limit },
    );
    return rows.reverse().map((row) => MikroOrmMessageRepository.toDomain(row));
  }

  async findByProviderMessageId(providerMessageId: string): Promise<Message | null> {
    const orm = await this.em.findOne(MessageOrmEntity, {
      evolutionMessageId: providerMessageId,
    });
    return orm ? MikroOrmMessageRepository.toDomain(orm) : null;
  }

  async existsByProviderMessageId(providerMessageId: string): Promise<boolean> {
    const count = await this.em.count(MessageOrmEntity, {
      evolutionMessageId: providerMessageId,
    });
    return count > 0;
  }

  /** Feeds `inbound_rate`, one of the throttle's signals (§2.1). */
  async countInboundForChannelAndDate(channelId: string, date: string): Promise<number> {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 86_400_000);
    return this.em.count(MessageOrmEntity, {
      channelId,
      direction: MessageDirection.INBOUND,
      occurredAt: { $gte: start, $lt: end },
    });
  }

  private static toDomain(orm: MessageOrmEntity): Message {
    return Message.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      conversationId: orm.conversationId,
      contactId: orm.contactId,
      channelId: orm.channelId,
      direction: orm.direction,
      kind: orm.kind,
      body: orm.body,
      mediaStorageKey: orm.mediaStorageKey,
      providerMessageId: orm.evolutionMessageId,
      deliveryStatus: orm.deliveryStatus,
      dispatchId: orm.dispatchId,
      sentBy: orm.sentBy,
      occurredAt: orm.occurredAt,
      createdAt: orm.createdAt,
    });
  }
}

@Injectable()
export class MikroOrmQuickReplyRepository implements QuickReplyRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<QuickReply | null> {
    const orm = await this.em.findOne(QuickReplyOrmEntity, { id });
    return orm ? MikroOrmQuickReplyRepository.toDomain(orm) : null;
  }

  async list(search?: string): Promise<QuickReply[]> {
    const where: Record<string, unknown> = {};
    if (search?.trim()) {
      where.title = { $ilike: `%${search.trim()}%` };
    }
    const rows = await this.em.find(QuickReplyOrmEntity, where, {
      // Most-used first: the library is a tool, and the tool the team reaches for should be on top.
      orderBy: [{ usageCount: 'DESC' }, { title: 'ASC' }],
    });
    return rows.map((row) => MikroOrmQuickReplyRepository.toDomain(row));
  }

  async save(quickReply: QuickReply): Promise<QuickReply> {
    await this.em.upsert(QuickReplyOrmEntity, {
      id: quickReply.id,
      accountId: quickReply.accountId,
      title: quickReply.title,
      body: quickReply.body,
      tags: [...quickReply.tags],
      createdBy: quickReply.createdBy,
      usageCount: quickReply.usageCount,
      createdAt: quickReply.createdAt,
    });
    await this.em.flush();
    return quickReply;
  }

  async delete(id: string): Promise<void> {
    // Tenant-scoped by the global filter: an id from another account matches nothing.
    await this.em.nativeDelete(QuickReplyOrmEntity, { id });
  }

  private static toDomain(orm: QuickReplyOrmEntity): QuickReply {
    return QuickReply.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      title: orm.title,
      body: orm.body,
      tags: orm.tags ?? [],
      createdBy: orm.createdBy,
      usageCount: orm.usageCount,
      createdAt: orm.createdAt,
    });
  }
}
