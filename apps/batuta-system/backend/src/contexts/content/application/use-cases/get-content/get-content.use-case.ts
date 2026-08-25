import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  FILE_STORAGE,
  FileStoragePort,
} from '../../../../../infrastructure/storage/ports/file-storage.port';
import { ContentId } from '../../../domain/value-objects/content-id.vo';
import { ContentNotFoundException } from '../../../domain/exceptions/content-not-found.exception';
import { ContentDto } from '../../dto/content.dto';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../ports/output/content-repository.port';
import { GetContentQuery } from './get-content.query';

/** Signed media URLs live long enough to render a page, not long enough to be shared around. */
const MEDIA_URL_TTL_SECONDS = 300;

@Injectable()
export class GetContentUseCase implements UseCase<GetContentQuery, ContentDto> {
  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
  ) {}

  async execute(query: GetContentQuery): Promise<ContentDto> {
    // Tenant-scoped: a content of another account resolves to null, so the caller gets 404.
    const content = await this.contents.findById(ContentId.from(query.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    const dto = ContentDto.fromDomain(content);

    // Media is served through time-limited signed URLs — objects are never public, and the storage
    // key never reaches the client.
    dto.media = await Promise.all(
      content.media.map(async (asset) => ({
        id: asset.id,
        variantId: asset.variantId,
        kind: asset.kind,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        originalName: asset.originalName,
        downloadUrl: await this.signedUrlOrNull(query.accountId, asset.storageKey),
      })),
    );

    return dto;
  }

  /** A storage outage must not make the content unreadable — the text still matters. */
  private async signedUrlOrNull(accountId: string, storageKey: string): Promise<string | null> {
    try {
      return await this.storage.getSignedUrl(accountId, storageKey, MEDIA_URL_TTL_SECONDS);
    } catch {
      return null;
    }
  }
}
