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
import { UpdateVariantCommand } from './update-variant.command';

/**
 * Edits a variant, or marks it reviewed by a human (§7 item 5).
 *
 * The two are asymmetric on purpose: changing the body changes the message, so it recomputes the hash
 * and can invalidate an approval; marking it reviewed changes nothing anyone would receive, so it
 * touches neither. Editing also CLEARS a previous review, because what was reviewed is no longer what
 * is there.
 */
@Injectable()
export class UpdateVariantUseCase implements UseCase<UpdateVariantCommand, ContentDto> {
  private readonly logger = new Logger(UpdateVariantUseCase.name);

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: UpdateVariantCommand): Promise<ContentDto> {
    const content = await this.contents.findById(ContentId.from(command.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    if (command.body !== undefined) {
      content.changeVariantBody(command.variantId, command.body);
    }
    if (command.markReviewed) {
      content.markVariantReviewed(command.variantId, command.performedBy);
    }

    const saved = await this.contents.save(content);
    const events = content.pullDomainEvents();
    await this.events.publishAll(events);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: command.markReviewed
        ? AuditAction.CONTENT_VARIANT_REVIEWED
        : AuditAction.CONTENT_VARIANT_UPDATED,
      entityType: 'content',
      entityId: saved.id.value,
      ip: command.ip ?? null,
      payload: {
        variantId: command.variantId,
        bodyChanged: command.body !== undefined,
        approvalInvalidated: events.length > 0,
      },
    });

    this.logger.log('Variante atualizada', {
      contentId: saved.id.value,
      variantId: command.variantId,
    });
    return ContentDto.fromDomain(saved);
  }
}
