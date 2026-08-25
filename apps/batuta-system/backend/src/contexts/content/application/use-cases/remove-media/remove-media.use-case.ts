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
import { RemoveMediaCommand } from './remove-media.command';

/**
 * Detaches a media asset. The reference goes; the stored object stays.
 *
 * Deleting the file would be tidier and wrong: an audit export of a past distribution (§11 item 2)
 * points at what was actually sent, and that includes the image. Storage is cheap; an unanswerable
 * question about a message is not.
 */
@Injectable()
export class RemoveMediaUseCase implements UseCase<RemoveMediaCommand, ContentDto> {
  private readonly logger = new Logger(RemoveMediaUseCase.name);

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: RemoveMediaCommand): Promise<ContentDto> {
    const content = await this.contents.findById(ContentId.from(command.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    const removed = content.removeMedia(command.mediaId);

    const saved = await this.contents.save(content);
    const events = content.pullDomainEvents();
    await this.events.publishAll(events);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CONTENT_MEDIA_REMOVED,
      entityType: 'content',
      entityId: saved.id.value,
      ip: command.ip,
      payload: {
        mediaId: removed.id,
        kind: removed.kind,
        approvalInvalidated: events.length > 0,
      },
    });

    this.logger.log('Mídia removida do conteúdo', {
      contentId: saved.id.value,
      mediaId: removed.id,
    });
    return ContentDto.fromDomain(saved);
  }
}
