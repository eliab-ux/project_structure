import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { QuickReply } from '../../../domain/entities/quick-reply.entity';
import { QuickReplyNotFoundException } from '../../../domain/exceptions/quick-reply-not-found.exception';
import { QuickReplyDto } from '../../dto/inbox.dto';
import {
  QUICK_REPLY_REPOSITORY,
  QuickReplyRepositoryPort,
} from '../../ports/output/inbox-repositories.port';
import {
  DeleteQuickReplyCommand,
  ListQuickRepliesQuery,
  SaveQuickReplyCommand,
} from './manage-quick-replies.commands';

/**
 * The quick-reply library (§10.3 item 3).
 *
 * Create and update in one use case: the difference is whether an id arrived, and two files that share
 * every line except one branch is not a separation worth having.
 *
 * These are audited, unlike most CRUD in the system, for a specific reason: a quick reply is text that
 * will be sent to thousands of people in a mandate's name. Who wrote the template matters as much as who
 * pressed send.
 */
@Injectable()
export class SaveQuickReplyUseCase implements UseCase<SaveQuickReplyCommand, QuickReplyDto> {
  constructor(
    @Inject(QUICK_REPLY_REPOSITORY) private readonly quickReplies: QuickReplyRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: SaveQuickReplyCommand): Promise<QuickReplyDto> {
    let quickReply: QuickReply;

    if (command.quickReplyId) {
      const existing = await this.quickReplies.findById(command.quickReplyId);
      if (!existing) {
        throw new QuickReplyNotFoundException();
      }
      existing.change({ title: command.title, body: command.body, tags: command.tags });
      quickReply = existing;
    } else {
      quickReply = QuickReply.create({
        accountId: command.accountId,
        title: command.title ?? '',
        body: command.body ?? '',
        tags: command.tags,
        createdBy: command.performedBy,
      });
    }

    const saved = await this.quickReplies.save(quickReply);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: command.quickReplyId
        ? AuditAction.QUICK_REPLY_UPDATED
        : AuditAction.QUICK_REPLY_CREATED,
      entityType: 'quick_reply',
      entityId: saved.id,
      ip: command.ip,
      // The title and the length, not the body: the text lives in its own table and a template can be
      // long. What the trail needs is that this person changed this template, and when.
      payload: { title: saved.title, bodyLength: saved.body.length, tags: saved.tags },
    });

    return QuickReplyDto.fromDomain(saved);
  }
}

@Injectable()
export class ListQuickRepliesUseCase implements UseCase<ListQuickRepliesQuery, QuickReplyDto[]> {
  constructor(
    @Inject(QUICK_REPLY_REPOSITORY) private readonly quickReplies: QuickReplyRepositoryPort,
  ) {}

  async execute(query: ListQuickRepliesQuery): Promise<QuickReplyDto[]> {
    const list = await this.quickReplies.list(query.search);
    return list.map((quickReply) => QuickReplyDto.fromDomain(quickReply));
  }
}

/**
 * Deletes a template.
 *
 * A real delete, unlike almost everything else in this system, and the reason it is safe: `messages`
 * stores the TEXT THAT WAS SENT, not a reference to the template. Removing a quick reply cannot alter
 * the record of anything that already went out.
 */
@Injectable()
export class DeleteQuickReplyUseCase implements UseCase<DeleteQuickReplyCommand, void> {
  constructor(
    @Inject(QUICK_REPLY_REPOSITORY) private readonly quickReplies: QuickReplyRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: DeleteQuickReplyCommand): Promise<void> {
    const existing = await this.quickReplies.findById(command.quickReplyId);
    if (!existing) {
      throw new QuickReplyNotFoundException();
    }

    await this.quickReplies.delete(existing.id);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.QUICK_REPLY_DELETED,
      entityType: 'quick_reply',
      entityId: existing.id,
      ip: command.ip,
      payload: { title: existing.title, usageCount: existing.usageCount },
    });
  }
}
