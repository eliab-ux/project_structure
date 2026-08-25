import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../../../content/application/ports/output/content-repository.port';
import { ContentId } from '../../../../content/domain/value-objects/content-id.vo';
import { ContentNotFoundException } from '../../../../content/domain/exceptions/content-not-found.exception';
import { ApprovalSettings } from '../../../domain/entities/approval-settings.entity';
import { ApprovalRequestStatus } from '../../../domain/value-objects/approval-status.vo';
import { ApprovalProgressDto, ApprovalRequestDto } from '../../dto/approval.dto';
import {
  APPROVAL_REQUEST_REPOSITORY,
  APPROVAL_SETTINGS_REPOSITORY,
  APPROVER_REPOSITORY,
  ApprovalRequestRepositoryPort,
  ApprovalSettingsRepositoryPort,
  ApproverRepositoryPort,
} from '../../ports/output/approval-repositories.port';
import { ListApprovalRequestsQuery } from './list-approval-requests.query';

/**
 * Progress of a submission, for the author (FASE 10, screen 7).
 *
 * The counts consider only requests bound to the CURRENT `content_hash`: a decision on a version that
 * has since been edited is history, not progress, and showing it as progress would tell the author they
 * are one approval away when in fact they are back at zero.
 *
 * The rejection comment comes through here, which is what §8.5 means by "com comentário visível ao
 * autor".
 */
@Injectable()
export class ListApprovalRequestsUseCase implements UseCase<
  ListApprovalRequestsQuery,
  ApprovalProgressDto
> {
  constructor(
    @Inject(APPROVAL_REQUEST_REPOSITORY)
    private readonly requests: ApprovalRequestRepositoryPort,
    @Inject(APPROVER_REPOSITORY) private readonly approvers: ApproverRepositoryPort,
    @Inject(APPROVAL_SETTINGS_REPOSITORY)
    private readonly settingsRepository: ApprovalSettingsRepositoryPort,
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
  ) {}

  async execute(query: ListApprovalRequestsQuery): Promise<ApprovalProgressDto> {
    const content = await this.contents.findById(ContentId.from(query.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    const [requests, approvers, settings] = await Promise.all([
      this.requests.listForContent(query.contentId),
      this.approvers.listAll(),
      this.settingsRepository.find(),
    ]);

    const nameById = new Map(approvers.map((approver) => [approver.id, approver.name]));
    const effectiveSettings = settings ?? ApprovalSettings.createDefault(query.accountId);
    const currentVersion = requests.filter(
      (request) => request.contentHash === content.contentHash,
    );

    const dto = new ApprovalProgressDto();
    dto.contentId = content.id.value;
    dto.contentStatus = content.status;
    dto.contentHash = content.contentHash;
    dto.requiredApprovals = effectiveSettings.requiredFor(content.classification);
    dto.approvedCount = currentVersion.filter(
      (request) => request.status === ApprovalRequestStatus.APPROVED,
    ).length;
    dto.pendingCount = currentVersion.filter((request) => request.isPending).length;
    dto.rejectedCount = currentVersion.filter(
      (request) => request.status === ApprovalRequestStatus.REJECTED,
    ).length;
    // The full list includes older versions, so the author can see the whole story of the content.
    dto.requests = requests.map((request) =>
      ApprovalRequestDto.fromDomain(request, nameById.get(request.approverId) ?? 'Aprovador'),
    );
    return dto;
  }
}
