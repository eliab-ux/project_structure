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
import { AddVariantCommand } from './add-variant.command';

/**
 * Adds a variant of the same content, for audience fit (§7 item 5).
 *
 * `createdBy` is the authenticated user, always — there is no code path that creates a variant
 * without a human author. §2 forbids automatic variant generation outright ("Variante existe para
 * adequação de público e é redigida ou revisada por humano"), because generating variants to dodge
 * duplicate detection is precisely the behaviour that gets numbers banned.
 */
@Injectable()
export class AddVariantUseCase implements UseCase<AddVariantCommand, ContentDto> {
  private readonly logger = new Logger(AddVariantUseCase.name);

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: AddVariantCommand): Promise<ContentDto> {
    const content = await this.contents.findById(ContentId.from(command.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    // Validates merge fields and rejects a duplicate label.
    const variant = content.addVariant({
      label: command.label,
      body: command.body,
      createdBy: command.performedBy,
    });

    const saved = await this.contents.save(content);
    const events = content.pullDomainEvents();
    await this.events.publishAll(events);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CONTENT_VARIANT_ADDED,
      entityType: 'content',
      entityId: saved.id.value,
      ip: command.ip,
      payload: {
        variantId: variant.id,
        label: variant.label,
        approvalInvalidated: events.length > 0,
      },
    });

    this.logger.log('Variante adicionada', { contentId: saved.id.value, variantId: variant.id });
    return ContentDto.fromDomain(saved);
  }
}
