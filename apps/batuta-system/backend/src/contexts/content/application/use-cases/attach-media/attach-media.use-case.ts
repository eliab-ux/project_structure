import { randomUUID } from 'crypto';
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
import {
  FILE_STORAGE,
  FileStoragePort,
} from '../../../../../infrastructure/storage/ports/file-storage.port';
import { ContentId } from '../../../domain/value-objects/content-id.vo';
import { ContentNotFoundException } from '../../../domain/exceptions/content-not-found.exception';
import { InvalidMediaException } from '../../../domain/exceptions/invalid-media.exception';
import { assertValidMedia, mediaKindForMime } from '../../../domain/services/media-policy';
import { ContentDto } from '../../dto/content.dto';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../ports/output/content-repository.port';
import { AttachMediaCommand } from './attach-media.command';

/**
 * Attaches a file to a content or to one of its variants (§7 item 4).
 *
 * Base64 in JSON, never multipart — the Fastify rule from CLAUDE.md.
 *
 * Order: validate → store in MinIO → record the reference. Validating first means a rejected file
 * never touches storage; storing before recording means a crash leaves an orphan object (cheap, a
 * cleanup sweep finds it) rather than a reference to a file that does not exist (breaks a send).
 *
 * Attaching changes `content_hash`, so it invalidates an approval — the approver signed off on a
 * message WITH that image (§8.5).
 */
@Injectable()
export class AttachMediaUseCase implements UseCase<AttachMediaCommand, ContentDto> {
  private readonly logger = new Logger(AttachMediaUseCase.name);

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: AttachMediaCommand): Promise<ContentDto> {
    const content = await this.contents.findById(ContentId.from(command.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    const kind = mediaKindForMime(command.mimeType);
    if (!kind) {
      throw new InvalidMediaException(
        `Formato ${command.mimeType || 'não informado'} não é aceito. ` +
          'Envie imagem (jpeg/png/webp), vídeo (mp4/3gpp) ou documento (pdf/office).',
      );
    }

    const buffer = Buffer.from(command.fileBase64, 'base64');
    // Throws with an actionable message: size, format or content/declaration mismatch.
    assertValidMedia({ kind, mimeType: command.mimeType, sizeBytes: buffer.length, buffer });

    const extension = command.fileName.includes('.')
      ? command.fileName.split('.').pop()?.toLowerCase().slice(0, 8)
      : undefined;
    const storageKey = `contents/${content.id.value}/${randomUUID()}${extension ? `.${extension}` : ''}`;

    await this.storage.putObject({
      accountId: command.accountId,
      key: storageKey,
      body: buffer,
      mimeType: command.mimeType,
    });

    const asset = content.attachMedia({
      variantId: command.variantId,
      kind,
      storageKey,
      mimeType: command.mimeType,
      sizeBytes: buffer.length,
      originalName: command.fileName,
    });

    const saved = await this.contents.save(content);
    const events = content.pullDomainEvents();
    await this.events.publishAll(events);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CONTENT_MEDIA_ATTACHED,
      entityType: 'content',
      entityId: saved.id.value,
      ip: command.ip,
      payload: {
        mediaId: asset.id,
        kind: asset.kind,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        approvalInvalidated: events.length > 0,
      },
    });

    this.logger.log('Mídia anexada ao conteúdo', {
      contentId: saved.id.value,
      kind: asset.kind,
      sizeBytes: asset.sizeBytes,
    });
    return ContentDto.fromDomain(saved);
  }
}
