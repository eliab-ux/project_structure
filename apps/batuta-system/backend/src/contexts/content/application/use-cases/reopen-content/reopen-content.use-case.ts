import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { ContentId } from '../../../domain/value-objects/content-id.vo';
import { ContentNotFoundException } from '../../../domain/exceptions/content-not-found.exception';
import { ContentDto } from '../../dto/content.dto';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../ports/output/content-repository.port';

export class ReopenContentCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly contentId: string,
    public readonly ip: string | null,
  ) {}
}

/**
 * Returns a REJECTED content to DRAFT without touching a word of it.
 *
 * Editing a rejected content already sends it back to DRAFT — that is the usual answer to a
 * rejection. This exists for the other case the entity documents: the author disagrees, talks to the
 * approver, and resubmits the SAME words. Forcing a cosmetic edit just to unlock resubmission would
 * change the `content_hash`, and the hash is supposed to mean "these exact words".
 *
 * Audited, because "this text was rejected and went back for approval unchanged" is precisely the
 * sequence someone will want to reconstruct later.
 */
@Injectable()
export class ReopenContentUseCase implements UseCase<ReopenContentCommand, ContentDto> {
  private readonly logger = new Logger(ReopenContentUseCase.name);

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ReopenContentCommand): Promise<ContentDto> {
    const content = await this.contents.findById(ContentId.from(command.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    const previousStatus = content.status;
    // No-op for anything that is not REJECTED — the aggregate decides, not this use case.
    content.returnToDraft();
    const saved = await this.contents.save(content);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CONTENT_REOPENED,
      entityType: 'content',
      entityId: saved.id.value,
      ip: command.ip,
      // The hash is in the trail because the point of this action is that it did NOT change.
      payload: { from: previousStatus, to: saved.status, contentHash: saved.contentHash },
    });

    this.logger.log('Conteúdo reaberto para edição', { contentId: saved.id.value });
    return ContentDto.fromDomain(saved);
  }
}
