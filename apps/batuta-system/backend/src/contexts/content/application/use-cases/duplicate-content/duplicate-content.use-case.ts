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
import { Content } from '../../../domain/entities/content.entity';
import { ContentId } from '../../../domain/value-objects/content-id.vo';
import { ContentCreatedEvent } from '../../../domain/events/content-created.event';
import { ContentNotFoundException } from '../../../domain/exceptions/content-not-found.exception';
import { ContentDto } from '../../dto/content.dto';
import {
  FILE_STORAGE,
  FileStoragePort,
} from '../../../../../infrastructure/storage/ports/file-storage.port';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../ports/output/content-repository.port';
import { DuplicateContentCommand } from './duplicate-content.command';

/** Extensão do arquivo original, para a chave nova não perder o sufixo (`.png`, `.mp4`). */
function extensionOf(storageKey: string): string {
  const match = /\.[A-Za-z0-9]{1,8}$/.exec(storageKey);
  return match ? match[0] : '';
}

/** Sufix on the copy's title, so two rows in the grid are never indistinguishable. */
const COPY_SUFFIX = ' (cópia)';

/**
 * Duplicates a content as a fresh DRAFT.
 *
 * The point of the feature is the common case: a message that worked, reused next week with three
 * words changed. Retyping it invites a typo in the part that was already right.
 *
 * **The copy is always DRAFT, and that is a security rule, not a convenience.** If a duplicate could
 * inherit `APPROVED`, duplicating an approved content would be a way to send un-approved text under
 * an approval that was granted for different words — which is exactly what §8.5 invalidates approvals
 * to prevent. `Content.create` is what builds it, so the copy cannot be born approved even if someone
 * later adds a field to this use case.
 *
 * It also gets a NEW `content_hash`, because the hash is the identity of a version and two contents
 * are two versions.
 *
 * Variants AND media are copied. Each media asset gets its OWN storage key, copied server-side: two
 * contents pointing at one key would mean deleting the media of one silently breaks the other, and
 * server-side means a 20 MB video never passes through this process.
 *
 * A media copy that fails does NOT fail the duplication. The copy is a draft whose whole purpose is to
 * be reviewed, and losing the text because one attachment did not copy would be the worse trade; the
 * result reports what was left behind so the operator re-attaches it deliberately.
 */
@Injectable()
export class DuplicateContentUseCase implements UseCase<DuplicateContentCommand, ContentDto> {
  private readonly logger = new Logger(DuplicateContentUseCase.name);

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: DuplicateContentCommand): Promise<ContentDto> {
    // Tenant-scoped read: a content of another account is simply not found.
    const source = await this.contents.findById(ContentId.from(command.contentId));
    if (!source) {
      throw new ContentNotFoundException();
    }

    const copy = Content.create({
      accountId: command.accountId,
      title: DuplicateContentUseCase.copyTitle(source.title),
      // The classification is copied, and it matters legally (§15 risco 6): an ELECTORAL text stays
      // ELECTORAL, so the copy needs the same number of approvals as the original.
      classification: source.classification,
      origin: source.origin,
      bodyBase: source.bodyBase,
      sourceUrl: source.sourceUrl,
      includeSourceUrl: source.includeSourceUrl,
      createdBy: command.performedBy,
    });

    // As variantes precisam existir ANTES da mídia: um asset pode estar amarrado a uma variante, e o
    // agregado recusa anexar mídia a uma variante que não existe. O mapa liga a variante da origem à
    // da cópia, porque os ids são novos.
    const variantIdByLabel = new Map<string, string>();
    const sourceVariantLabelById = new Map<string, string>();
    for (const variant of source.variants) {
      // Same labels: they identify the audience the variant addresses, and renaming them would make
      // the copy's variant mapping mean something different from the original's.
      const created = copy.addVariant({
        label: variant.label,
        body: variant.body,
        createdBy: command.performedBy,
      });
      variantIdByLabel.set(variant.label, created.id);
      sourceVariantLabelById.set(variant.id, variant.label);
    }

    const mediaNotCopied: string[] = [];
    for (const asset of source.media) {
      const destinationKey = `contents/${copy.id.value}/${randomUUID()}${extensionOf(asset.storageKey)}`;
      try {
        // Cópia no lado do servidor: os bytes não passam por este processo.
        await this.storage.copyObject({
          accountId: command.accountId,
          sourceKey: asset.storageKey,
          destinationKey,
        });
      } catch {
        // Não derruba a duplicação — ver o docblock. O que se perde é um anexo, e a tela diz qual.
        mediaNotCopied.push(asset.originalName);
        continue;
      }

      const sourceLabel = asset.variantId ? sourceVariantLabelById.get(asset.variantId) : null;
      copy.attachMedia({
        variantId: sourceLabel ? (variantIdByLabel.get(sourceLabel) ?? null) : null,
        kind: asset.kind,
        storageKey: destinationKey,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        originalName: asset.originalName,
      });
    }

    // The copy is brand new, so nothing it emitted is an approval invalidation worth publishing.
    copy.pullDomainEvents();

    const saved = await this.contents.save(copy);

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
      action: AuditAction.CONTENT_DUPLICATED,
      entityType: 'content',
      entityId: saved.id.value,
      ip: command.ip,
      // `sourceContentId` is the whole reason this action exists in the trail: it answers "where did
      // this text come from", which is the question asked when two similar messages went out.
      payload: {
        sourceContentId: source.id.value,
        sourceContentHash: source.contentHash,
        classification: saved.classification,
        variantsCopied: saved.variants.length,
        mediaCopied: saved.media.length,
        mediaNotCopied,
      },
    });

    this.logger.log('Conteúdo duplicado', {
      contentId: saved.id.value,
      sourceContentId: source.id.value,
    });
    return ContentDto.fromDomain(saved);
  }

  /**
   * Avoids "Aviso (cópia) (cópia) (cópia)" when someone duplicates a copy: the suffix is added once
   * and a numbered form takes over from there. The 200-char cap is the column's.
   */
  private static copyTitle(original: string): string {
    const base = original.endsWith(COPY_SUFFIX)
      ? original.slice(0, -COPY_SUFFIX.length)
      : original.replace(/ \(cópia \d+\)$/, '');

    const alreadyCopy = original !== base;
    const title = alreadyCopy ? `${base} (cópia 2)` : `${original}${COPY_SUFFIX}`;
    return title.length > 200 ? title.slice(0, 200) : title;
  }
}
