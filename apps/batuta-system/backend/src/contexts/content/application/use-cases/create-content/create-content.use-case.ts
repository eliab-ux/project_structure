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
import { Content } from '../../../domain/entities/content.entity';
import { ContentCreatedEvent } from '../../../domain/events/content-created.event';
import { ContentDto } from '../../dto/content.dto';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../ports/output/content-repository.port';
import { CreateContentCommand } from './create-content.command';

/**
 * Creates a content in DRAFT.
 *
 * Two rules are enforced by the aggregate rather than here, on purpose: `classification` is required
 * by the constructor signature (§1.3), and every merge field must be known and carry a fallback
 * (§7.4). Putting them in the entity means a second entry point cannot bypass either.
 */
@Injectable()
export class CreateContentUseCase implements UseCase<CreateContentCommand, ContentDto> {
  private readonly logger = new Logger(CreateContentUseCase.name);

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: CreateContentCommand): Promise<ContentDto> {
    // Throws InvalidMergeFieldException listing every offending field.
    const content = Content.create({
      accountId: command.accountId,
      title: command.title,
      classification: command.classification,
      origin: command.origin,
      bodyBase: command.bodyBase,
      sourceUrl: command.sourceUrl,
      includeSourceUrl: command.includeSourceUrl,
      createdBy: command.performedBy,
    });

    const saved = await this.contents.save(content);

    await this.events.publish(
      new ContentCreatedEvent(
        command.accountId,
        saved.id.value,
        saved.classification,
        command.performedBy,
      ),
    );

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CONTENT_CREATED,
      entityType: 'content',
      entityId: saved.id.value,
      ip: command.ip,
      // The classification is in the trail because it is the fact that matters legally (§15 risco 6).
      payload: {
        title: saved.title,
        classification: saved.classification,
        origin: saved.origin,
        contentHash: saved.contentHash,
      },
    });

    this.logger.log('Conteúdo criado', {
      contentId: saved.id.value,
      classification: saved.classification,
    });
    return ContentDto.fromDomain(saved);
  }
}
