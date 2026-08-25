import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
} from '../../../../../infrastructure/persistence/ports/event-publisher.port';
import { ContentId } from '../../../domain/value-objects/content-id.vo';
import { ContentNotFoundException } from '../../../domain/exceptions/content-not-found.exception';
import { ContentDto } from '../../dto/content.dto';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../ports/output/content-repository.port';
import { UpdateContentCommand } from './update-content.command';

/**
 * Edits a content.
 *
 * The consequential part is invisible here: any change to the body recomputes `content_hash`, and if
 * the content was APPROVED or PENDING_APPROVAL the aggregate destroys the approval and returns it to
 * DRAFT (§8.5), emitting the event the approval context reacts to.
 *
 * That logic is NOT duplicated in this use case — it happens inside `changeBody`, so every path that
 * edits a body gets it, including the ones a future phase adds.
 */
@Injectable()
export class UpdateContentUseCase implements UseCase<UpdateContentCommand, ContentDto> {
  private readonly logger = new Logger(UpdateContentUseCase.name);

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: UpdateContentCommand): Promise<ContentDto> {
    const content = await this.contents.findById(ContentId.from(command.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    const previousStatus = content.status;
    const previousHash = content.contentHash;

    if (command.title !== undefined) {
      content.changeTitle(command.title);
    }
    if (command.bodyBase !== undefined) {
      content.changeBody(command.bodyBase);
    }
    if (command.sourceUrl !== undefined) {
      content.changeSourceUrl(command.sourceUrl);
    }
    if (command.includeSourceUrl !== undefined) {
      content.changeIncludeSourceUrl(command.includeSourceUrl);
    }

    const saved = await this.contents.save(content);
    const events = content.pullDomainEvents();
    await this.events.publishAll(events);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CONTENT_UPDATED,
      entityType: 'content',
      entityId: saved.id.value,
      ip: command.ip ?? null,
      payload: {
        previousHash,
        newHash: saved.contentHash,
        previousStatus,
        status: saved.status,
        // Explicit in the trail: an approver needs to see that their approval was voided by an edit.
        approvalInvalidated: events.length > 0,
      },
    });

    if (events.length > 0) {
      this.logger.warn('Edição invalidou a aprovação do conteúdo', {
        contentId: saved.id.value,
        previousStatus,
      });
    }

    return ContentDto.fromDomain(saved);
  }
}
