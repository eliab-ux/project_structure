import { Inject, Injectable, Logger } from '@nestjs/common';
import { PaginatedResult, Pagination, UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../../../audience/application/ports/output/contact-repository.port';
import { ContactId } from '../../../../audience/domain/value-objects/contact-id.vo';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../../../channel/application/ports/output/channel-repository.port';
import {
  FILE_STORAGE,
  FileStoragePort,
} from '../../../../../infrastructure/storage/ports/file-storage.port';
import { InboxConfig } from '../../../../../config/inbox.config';
import { ConversationStatus } from '../../../domain/value-objects/conversation-status.vo';
import { ConversationNotFoundException } from '../../../domain/exceptions/conversation-not-found.exception';
import {
  ConversationDetailDto,
  ConversationSummaryDto,
  InboxCountersDto,
  MessageDto,
} from '../../dto/inbox.dto';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepositoryPort,
  MESSAGE_REPOSITORY,
  MessageRepositoryPort,
} from '../../ports/output/inbox-repositories.port';
import {
  ListInboxQueueQuery,
  OpenConversationCommand,
  ResolveConversationCommand,
} from './manage-conversation.commands';

/**
 * The work queue (§10.1, §10.3 item 2).
 *
 * Ordered by priority and then by AGE — oldest first — which the repository does in SQL. That ordering
 * is the product: §10.3 says "Item parado três dias é pior que não ter a caixa", and a queue sorted by
 * arrival newest-first (the WhatsApp Web habit) is exactly how items rot at the bottom.
 *
 * The list carries the contact name and a message preview, not the full thread: this is a list of work,
 * and loading every history to render it would make the screen slow at the volumes that matter.
 */
@Injectable()
export class ListInboxQueueUseCase implements UseCase<
  ListInboxQueueQuery,
  PaginatedResult<ConversationSummaryDto>
> {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepositoryPort,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepositoryPort,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    private readonly config: InboxConfig,
  ) {}

  async execute(query: ListInboxQueueQuery): Promise<PaginatedResult<ConversationSummaryDto>> {
    const page = await this.conversations.list({
      ...Pagination.create(query.page, query.limit),
      status: query.status,
      priority: query.priority,
      intentClass: query.intentClass,
      channelId: query.channelId,
      unlockedOnly: query.unlockedOnly,
    });

    const now = new Date();
    const summaries = await Promise.all(
      page.data.map(async (conversation) => {
        const [contact, history] = await Promise.all([
          this.contacts.findById(ContactId.from(conversation.contactId)),
          // Just the tail, for the preview line.
          this.messages.listForConversation(conversation.id, 1),
        ]);
        return ConversationSummaryDto.from({
          conversation,
          contactName: contact?.name ?? null,
          contactPhoneMasked: contact?.phone.masked ?? '',
          lastMessage: history[history.length - 1] ?? null,
          ageMinutes: conversation.ageInMinutes(now),
          lockTtlMinutes: this.config.lockTtlMinutes,
          now,
        });
      }),
    );

    return { data: summaries, meta: page.meta };
  }
}

/**
 * Opens one item: takes the lock and returns the WHOLE conversation (§10.1, §10.3 item 1).
 *
 * The full history is not a nicety — §10.1: "não dá para responder 'sim, pode ser' sem ver o que veio
 * antes." It also returns which chip received it and which distribution started it, because an operator
 * answering "quando começa a obra?" needs to know which message the person is replying to.
 *
 * Signed URLs for media are minted here, with a short TTL, so an audio can be played inline (§10.2
 * item 3) without the storage bucket being public.
 */
@Injectable()
export class OpenConversationUseCase implements UseCase<
  OpenConversationCommand,
  ConversationDetailDto
> {
  private readonly logger = new Logger(OpenConversationUseCase.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepositoryPort,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepositoryPort,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
    private readonly config: InboxConfig,
  ) {}

  async execute(command: OpenConversationCommand): Promise<ConversationDetailDto> {
    const conversation = await this.conversations.findById(command.conversationId);
    if (!conversation) {
      throw new ConversationNotFoundException();
    }

    // Throws ConversationLockedException when someone else holds a live lock.
    conversation.lock(command.performedBy, this.config.lockTtlMinutes);
    const saved = await this.conversations.save(conversation);

    const [contact, channel, history] = await Promise.all([
      this.contacts.findById(ContactId.from(saved.contactId)),
      this.channels.listByAccount(),
      this.messages.listForConversation(saved.id, this.config.historyLimit),
    ]);

    const channelLabel =
      channel.find((entry) => entry.id.value === saved.channelId)?.label ?? 'Canal removido';

    const messages = await Promise.all(
      history.map(async (message) =>
        MessageDto.from(
          message,
          await this.signedUrlOrNull(saved.accountId, message.mediaStorageKey),
        ),
      ),
    );

    this.logger.debug('Conversa aberta', { conversationId: saved.id });

    return ConversationDetailDto.from({
      conversation: saved,
      contactName: contact?.name ?? null,
      contactPhoneMasked: contact?.phone.masked ?? '',
      contactTags: contact?.tags ?? [],
      channelLabel,
      messages,
      ageMinutes: saved.ageInMinutes(),
    });
  }

  /** A storage outage must not stop the operator reading the text of a conversation. */
  private async signedUrlOrNull(
    accountId: string,
    storageKey: string | null,
  ): Promise<string | null> {
    if (!storageKey) {
      return null;
    }
    try {
      return await this.storage.getSignedUrl(accountId, storageKey, this.config.mediaUrlTtlSeconds);
    } catch {
      return null;
    }
  }
}

/**
 * Resolve, archive, release or reassign (§10.3 item 4).
 *
 * One use case for four verbs because they are one decision with four outcomes, they share every
 * precondition, and splitting them would mean four files repeating the same three lookups.
 */
@Injectable()
export class ResolveConversationUseCase implements UseCase<
  ResolveConversationCommand,
  ConversationSummaryDto
> {
  private readonly logger = new Logger(ResolveConversationUseCase.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepositoryPort,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepositoryPort,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    private readonly config: InboxConfig,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ResolveConversationCommand): Promise<ConversationSummaryDto> {
    const conversation = await this.conversations.findById(command.conversationId);
    if (!conversation) {
      throw new ConversationNotFoundException();
    }

    switch (command.action) {
      case 'RESOLVE':
        conversation.resolve(command.performedBy);
        break;
      case 'ARCHIVE':
        conversation.archive(command.performedBy);
        break;
      case 'RELEASE':
        // Explicit "I am not handling this after all". Back to the queue, keeping its age — which is the
        // point: releasing must not make an old item look new.
        conversation.releaseLock();
        break;
      case 'REASSIGN':
        if (!command.targetOperatorId) {
          throw new ConversationNotFoundException();
        }
        conversation.reassignTo(command.targetOperatorId);
        break;
    }

    const saved = await this.conversations.save(conversation);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action:
        command.action === 'RESOLVE'
          ? AuditAction.INBOX_CONVERSATION_RESOLVED
          : command.action === 'ARCHIVE'
            ? AuditAction.INBOX_CONVERSATION_ARCHIVED
            : AuditAction.INBOX_CONVERSATION_REASSIGNED,
      entityType: 'conversation',
      entityId: saved.id,
      ip: command.ip,
      payload: {
        action: command.action,
        targetOperatorId: command.targetOperatorId ?? null,
        ageMinutesAtDecision: saved.ageInMinutes(),
      },
    });

    const [contact, history] = await Promise.all([
      this.contacts.findById(ContactId.from(saved.contactId)),
      this.messages.listForConversation(saved.id, 1),
    ]);

    this.logger.log('Conversa atualizada', { conversationId: saved.id, action: command.action });

    return ConversationSummaryDto.from({
      conversation: saved,
      contactName: contact?.name ?? null,
      contactPhoneMasked: contact?.phone.masked ?? '',
      lastMessage: history[history.length - 1] ?? null,
      ageMinutes: saved.ageInMinutes(),
      lockTtlMinutes: this.config.lockTtlMinutes,
      now: new Date(),
    });
  }
}

/** Queue health, for the dashboard (§11 item 3: "idade média da fila de pendências"). */
@Injectable()
export class GetInboxCountersUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepositoryPort,
  ) {}

  async execute(): Promise<InboxCountersDto> {
    const counters = await this.conversations.counters();
    const dto = new InboxCountersDto();
    dto.pendingReply = counters.pendingReply;
    dto.inProgress = counters.inProgress;
    dto.highPriority = counters.highPriority;
    dto.averageAgeMinutes = counters.averageAgeMinutes;
    dto.oldestAgeMinutes = counters.oldestAgeMinutes;
    return dto;
  }
}

/**
 * Frees locks whose TTL expired (§10.3 item 1: "liberação automática por TTL").
 *
 * Runs from a cron. Without it, an operator who closed the browser holds a contact hostage until
 * someone notices — and §10.3 is explicit that a stuck item is worse than not having the queue.
 */
@Injectable()
export class ReleaseExpiredLocksUseCase {
  private readonly logger = new Logger(ReleaseExpiredLocksUseCase.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepositoryPort,
    private readonly config: InboxConfig,
  ) {}

  /** Runs inside a tenant scope established by the caller. @returns how many were freed. */
  async execute(): Promise<number> {
    const stale = await this.conversations.listExpiredLocks(this.config.lockTtlMinutes);
    for (const conversation of stale) {
      conversation.releaseLock();
      await this.conversations.save(conversation);
    }
    if (stale.length > 0) {
      this.logger.warn('Travas expiradas liberadas', { released: stale.length });
    }
    return stale.length;
  }
}

/** Statuses the queue screen offers as filters. Kept here so the HTTP layer does not invent its own. */
export const QUEUE_DEFAULT_STATUSES: readonly ConversationStatus[] = [
  ConversationStatus.PENDING_REPLY,
  ConversationStatus.IN_PROGRESS,
];
