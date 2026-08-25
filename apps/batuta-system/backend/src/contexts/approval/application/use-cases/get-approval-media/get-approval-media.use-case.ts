import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../../../content/application/ports/output/content-repository.port';
import { ContentId } from '../../../../content/domain/value-objects/content-id.vo';
import {
  FILE_STORAGE,
  FileStoragePort,
} from '../../../../../infrastructure/storage/ports/file-storage.port';
import { TenantScopedJobRunner } from '../../../../../infrastructure/messaging/tenant-scoped-job.runner';
import { hashApprovalToken } from '../../../domain/value-objects/approval-token.vo';
import { InvalidApprovalTokenException } from '../../../domain/exceptions/invalid-approval-token.exception';
import {
  APPROVAL_REQUEST_REPOSITORY,
  ApprovalRequestRepositoryPort,
} from '../../ports/output/approval-repositories.port';
import { GetApprovalMediaQuery } from './get-approval-media.query';

export class ApprovalMediaDto {
  body!: Buffer;
  mimeType!: string;
  originalName!: string;
}

/**
 * Serves one media file of the content under approval, authorised by the magic-link token.
 *
 * The alternative was handing the browser a presigned storage URL, and it does not work here: the URL
 * is signed against the storage's INTERNAL endpoint (a Docker container name), which the approver's
 * browser cannot resolve. Exposing the object storage publicly just to fix that would be trading a
 * working feature for a permanent hole.
 *
 * Serving it through the app is also better than a presigned URL on its own terms: the authorisation is
 * the same one the page uses, so the file stops being reachable exactly when the token stops working.
 * A presigned URL, once forwarded — and this link travels by WhatsApp — keeps working for anyone until
 * it expires, regardless of what happens to the approval.
 *
 * `assertUsable` is deliberately NOT called: a decided or expired request must still render its own
 * page (that is how the approver learns why they cannot decide), and a page whose images 403 while the
 * text renders would look broken rather than explained.
 *
 * The media id is validated against THIS content, never trusted as a storage key. Without that check
 * the parameter would be a path into the bucket, and the bucket holds every content of the tenant.
 */
@Injectable()
export class GetApprovalMediaUseCase implements UseCase<GetApprovalMediaQuery, ApprovalMediaDto> {
  constructor(
    @Inject(APPROVAL_REQUEST_REPOSITORY)
    private readonly requests: ApprovalRequestRepositoryPort,
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
    private readonly runner: TenantScopedJobRunner,
  ) {}

  async execute(query: GetApprovalMediaQuery): Promise<ApprovalMediaDto> {
    const request = await this.requests.findByTokenHashUnscoped(hashApprovalToken(query.token));
    if (!request) {
      throw new InvalidApprovalTokenException();
    }

    return this.runner.run(request.accountId, async () => {
      const content = await this.contents.findById(ContentId.from(request.contentId));
      // The same generic exception as an unknown token: distinguishing "wrong token" from "wrong media
      // id" would confirm which of the two exists.
      const asset = content?.media.find((media) => media.id === query.mediaId);
      if (!asset) {
        throw new InvalidApprovalTokenException();
      }

      const dto = new ApprovalMediaDto();
      dto.body = await this.storage.getObject(request.accountId, asset.storageKey);
      dto.mimeType = asset.mimeType;
      dto.originalName = asset.originalName;
      return dto;
    });
  }
}
