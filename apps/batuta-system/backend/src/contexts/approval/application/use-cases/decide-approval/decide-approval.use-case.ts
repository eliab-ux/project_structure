import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../../../content/application/ports/output/content-repository.port';
import { ContentId } from '../../../../content/domain/value-objects/content-id.vo';
import { ContentNotFoundException } from '../../../../content/domain/exceptions/content-not-found.exception';
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
} from '../../../../../infrastructure/persistence/ports/event-publisher.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { TenantScopedJobRunner } from '../../../../../infrastructure/messaging/tenant-scoped-job.runner';
import { ApprovalRequest } from '../../../domain/entities/approval-request.entity';
import { ApprovalSettings } from '../../../domain/entities/approval-settings.entity';
import { ApprovalRequestStatus } from '../../../domain/value-objects/approval-status.vo';
import { hashApprovalToken } from '../../../domain/value-objects/approval-token.vo';
import { InvalidApprovalTokenException } from '../../../domain/exceptions/invalid-approval-token.exception';
import { ContentApprovedEvent } from '../../../domain/events/content-approved.event';
import { ContentRejectedEvent } from '../../../domain/events/content-rejected.event';
import { ApprovalDecisionResultDto } from '../../dto/approval.dto';
import {
  APPROVAL_REQUEST_REPOSITORY,
  APPROVAL_SETTINGS_REPOSITORY,
  APPROVER_REPOSITORY,
  ApprovalRequestRepositoryPort,
  ApprovalSettingsRepositoryPort,
  ApproverRepositoryPort,
} from '../../ports/output/approval-repositories.port';
import { DecideApprovalCommand } from './decide-approval.command';

/**
 * Records one approver's decision, from the magic-link page (§8 item 4).
 *
 * This runs with NO authenticated user: the caller is an approver who may not have an account at all.
 * What stands in for authentication:
 *  - the token (256 bits, stored hashed, single use, short TTL);
 *  - the hash check — the link stops working the moment the content changes (§8.5);
 *  - the rate limit on the route, which is the HTTP adapter's job.
 *
 * The two content-level invariants of §8.5 are applied here, because they need the COUNT across
 * requests, which no single aggregate owns:
 *  - APPROVED only when the required number of approvals is reached;
 *  - one rejection is enough to reject the content.
 *
 * Note the shape of the method: ONE unscoped read to resolve the token, then everything else inside
 * `TenantScopedJobRunner` with the accountId that read produced. Without that wrapper the tenant filter
 * of FASE 1 would (correctly) throw on the very next query, because no JWT ever established a scope on
 * this path. The tenant is therefore derived from the token, never from anything the caller sent.
 */
@Injectable()
export class DecideApprovalUseCase implements UseCase<
  DecideApprovalCommand,
  ApprovalDecisionResultDto
> {
  private readonly logger = new Logger(DecideApprovalUseCase.name);

  constructor(
    @Inject(APPROVAL_REQUEST_REPOSITORY)
    private readonly requests: ApprovalRequestRepositoryPort,
    @Inject(APPROVAL_SETTINGS_REPOSITORY)
    private readonly settingsRepository: ApprovalSettingsRepositoryPort,
    @Inject(APPROVER_REPOSITORY) private readonly approvers: ApproverRepositoryPort,
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
    private readonly runner: TenantScopedJobRunner,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: DecideApprovalCommand): Promise<ApprovalDecisionResultDto> {
    // The plaintext token never leaves this line: it is hashed and forgotten.
    const tokenHash = hashApprovalToken(command.token);

    // Unscoped by necessity — no JWT exists on this path. The request carries the accountId that
    // scopes everything after it.
    const request = await this.requests.findByTokenHashUnscoped(tokenHash);
    if (!request) {
      throw new InvalidApprovalTokenException();
    }

    // From here on the tenant scope is in force, established from the token's own accountId.
    return this.runner.run(request.accountId, () => this.decide(request, command));
  }

  private async decide(
    request: ApprovalRequest,
    command: DecideApprovalCommand,
  ): Promise<ApprovalDecisionResultDto> {
    const content = await this.contents.findById(ContentId.from(request.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    // Throws for: already decided, invalidated, expired, or content changed since the link went out.
    request.assertUsable(content.contentHash);

    const [settings, siblings, approver] = await Promise.all([
      this.settingsRepository.find(),
      this.requests.listForContent(request.contentId),
      this.approvers.findById(request.approverId),
    ]);

    const effectiveSettings = settings ?? ApprovalSettings.createDefault(request.accountId);
    const required = effectiveSettings.requiredFor(content.classification);

    const context = {
      ip: command.ip,
      userAgent: command.userAgent,
      comment: command.comment,
    };

    if (command.decision === 'APPROVE') {
      request.approve(context);
    } else {
      request.reject(context);
    }

    // Approvals for THIS version only: a decision on an older hash must not count.
    const approvedCount =
      siblings.filter(
        (sibling) =>
          sibling.id !== request.id &&
          sibling.status === ApprovalRequestStatus.APPROVED &&
          sibling.contentHash === content.contentHash,
      ).length + (command.decision === 'APPROVE' ? 1 : 0);

    let contentApproved = false;
    let contentRejected = false;

    await this.unitOfWork.execute(async () => {
      await this.requests.save(request);

      if (command.decision === 'REJECT') {
        content.rejectApproval();
        contentRejected = true;
      } else {
        contentApproved = content.registerApproval(approvedCount, required);
      }

      await this.contents.save(content);
    });

    await this.events.publishAll(request.pullDomainEvents());
    if (contentApproved) {
      await this.events.publish(
        new ContentApprovedEvent(
          request.accountId,
          content.id.value,
          content.contentHash,
          approvedCount,
        ),
      );
    }
    if (contentRejected) {
      await this.events.publish(
        new ContentRejectedEvent(
          request.accountId,
          content.id.value,
          request.approverId,
          request.comment,
        ),
      );
    }

    await this.audit.execute({
      accountId: request.accountId,
      // The actor is an approver, not a user of the account — many of them have no account at all.
      actorType: AuditActorType.SYSTEM,
      actorId: null,
      action:
        command.decision === 'APPROVE'
          ? AuditAction.CONTENT_APPROVAL_GRANTED
          : AuditAction.CONTENT_APPROVAL_REJECTED,
      entityType: 'content',
      entityId: content.id.value,
      ip: command.ip,
      // Everything a later question needs: who decided, on which version, and what it produced.
      payload: {
        requestId: request.id,
        approverId: request.approverId,
        approverName: approver?.name ?? null,
        contentHash: request.contentHash,
        comment: request.comment,
        approvalsSoFar: approvedCount,
        requiredApprovals: required,
        contentStatus: content.status,
      },
    });

    this.logger.log('Decisão de aprovação registrada', {
      contentId: content.id.value,
      decision: command.decision,
      approvalsSoFar: approvedCount,
      required,
      contentStatus: content.status,
    });

    const dto = new ApprovalDecisionResultDto();
    dto.decision = command.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    dto.contentTitle = content.title;
    dto.contentApproved = contentApproved;
    dto.contentRejected = contentRejected;
    dto.approvalsSoFar = approvedCount;
    dto.requiredApprovals = required;
    return dto;
  }
}
