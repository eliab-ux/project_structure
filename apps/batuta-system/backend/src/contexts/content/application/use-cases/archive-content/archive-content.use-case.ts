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
import { ArchiveContentCommand } from './archive-content.command';

/**
 * Takes a content out of circulation without deleting it.
 *
 * There is no delete endpoint at all, and that is the point: a content that was ever distributed is
 * referenced by the audit trail and by the export of 11 item 2. Archiving makes it read-only forever.
 */
@Injectable()
export class ArchiveContentUseCase implements UseCase<ArchiveContentCommand, ContentDto> {
  private readonly logger = new Logger(ArchiveContentUseCase.name);

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ArchiveContentCommand): Promise<ContentDto> {
    const content = await this.contents.findById(ContentId.from(command.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    const previousStatus = content.status;
    content.archive();
    const saved = await this.contents.save(content);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CONTENT_ARCHIVED,
      entityType: 'content',
      entityId: saved.id.value,
      ip: command.ip,
      payload: { previousStatus },
    });

    this.logger.log('Conteúdo arquivado', { contentId: saved.id.value });
    return ContentDto.fromDomain(saved);
  }
}
