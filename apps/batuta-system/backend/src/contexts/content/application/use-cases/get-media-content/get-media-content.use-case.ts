import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  FILE_STORAGE,
  FileStoragePort,
} from '../../../../../infrastructure/storage/ports/file-storage.port';
import { ContentId } from '../../../domain/value-objects/content-id.vo';
import { ContentNotFoundException } from '../../../domain/exceptions/content-not-found.exception';
import { MediaNotFoundException } from '../../../domain/exceptions/media-not-found.exception';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../ports/output/content-repository.port';

export class GetMediaContentQuery {
  constructor(
    public readonly accountId: string,
    public readonly contentId: string,
    public readonly mediaId: string,
  ) {}
}

export class MediaContentDto {
  body!: Buffer;
  mimeType!: string;
  originalName!: string;
}

/**
 * Serves the bytes of one media asset to the app itself.
 *
 * Same reason as the approval-page route: a presigned storage URL is signed against the storage's
 * INTERNAL endpoint (a container name), so a browser cannot open it. Streaming through the API keeps
 * the tenant filter in the path — the asset is looked up inside the content, which is looked up inside
 * the account — instead of handing out a URL that carries its own authorisation.
 *
 * The `mediaId` is resolved against the content, never used as a storage key. Otherwise the parameter
 * would be a path into a bucket that holds every content of the tenant.
 */
@Injectable()
export class GetMediaContentUseCase implements UseCase<GetMediaContentQuery, MediaContentDto> {
  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
  ) {}

  async execute(query: GetMediaContentQuery): Promise<MediaContentDto> {
    // Tenant-scoped: a content of another account is simply not found.
    const content = await this.contents.findById(ContentId.from(query.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    const asset = content.media.find((media) => media.id === query.mediaId);
    if (!asset) {
      throw new MediaNotFoundException();
    }

    const dto = new MediaContentDto();
    dto.body = await this.storage.getObject(query.accountId, asset.storageKey);
    dto.mimeType = asset.mimeType;
    dto.originalName = asset.originalName;
    return dto;
  }
}
