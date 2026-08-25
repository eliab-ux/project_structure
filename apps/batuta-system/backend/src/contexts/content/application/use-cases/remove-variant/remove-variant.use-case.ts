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
import { RemoveVariantCommand } from './remove-variant.command';

/**
 * Removes a variant.
 *
 * The media attached to that variant goes with it — an orphan asset would still be counted in
 * `content_hash` and would keep invalidating approvals for a variant nobody can see. The stored
 * objects themselves are left in MinIO: a cleanup sweep is cheap, deleting a file that an audit export
 * still references is not.
 */
@Injectable()
export class RemoveVariantUseCase implements UseCase<RemoveVariantCommand, ContentDto> {
  private readonly logger = new Logger(RemoveVariantUseCase.name);

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: RemoveVariantCommand): Promise<ContentDto> {
    const content = await this.contents.findById(ContentId.from(command.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    content.removeVariant(command.variantId);

    const saved = await this.contents.save(content);
    const events = content.pullDomainEvents();
    await this.events.publishAll(events);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CONTENT_VARIANT_REMOVED,
      entityType: 'content',
      entityId: saved.id.value,
      ip: command.ip,
      payload: { variantId: command.variantId, approvalInvalidated: events.length > 0 },
    });

    this.logger.log('Variante removida', {
      contentId: saved.id.value,
      variantId: command.variantId,
    });
    return ContentDto.fromDomain(saved);
  }
}
