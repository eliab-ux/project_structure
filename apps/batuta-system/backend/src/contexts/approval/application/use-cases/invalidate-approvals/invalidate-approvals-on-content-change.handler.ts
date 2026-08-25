import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ContentApprovalInvalidatedEvent } from '../../../../content/domain/events/content-approval-invalidated.event';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { TenantScopedJobRunner } from '../../../../../infrastructure/messaging/tenant-scoped-job.runner';
import {
  APPROVAL_REQUEST_REPOSITORY,
  ApprovalRequestRepositoryPort,
} from '../../ports/output/approval-repositories.port';

/**
 * Completes §8.5: "`content_hash` muda → requests viram `INVALIDATED`, conteúdo volta a `DRAFT`."
 *
 * The content aggregate does the DETECTION (it owns the hash) and returns itself to DRAFT; this handler
 * does the CONSEQUENCE on the approval side. The split is deliberate — the content context must not
 * know that approval requests exist as rows, and the approval context must not have to poll for edits.
 *
 * Runs inside TenantScopedJobRunner because an event handler has no request scope: the emitting request
 * may already have finished, so the tenant filter needs establishing from the event's own accountId.
 *
 * A failure here is logged and swallowed. The alternative — letting it bubble — would break the edit
 * that triggered it, and the read path already refuses a request whose hash no longer matches
 * (`assertUsable`), so a stale PENDING row is inert rather than dangerous.
 */
@Injectable()
export class InvalidateApprovalsOnContentChangeHandler {
  private readonly logger = new Logger(InvalidateApprovalsOnContentChangeHandler.name);

  constructor(
    @Inject(APPROVAL_REQUEST_REPOSITORY)
    private readonly requests: ApprovalRequestRepositoryPort,
    private readonly runner: TenantScopedJobRunner,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  @OnEvent('content.approval_invalidated')
  async handle(event: ContentApprovalInvalidatedEvent): Promise<void> {
    try {
      await this.runner.run(event.accountId, async () => {
        const invalidated = await this.requests.invalidatePendingForContent(event.contentId);

        if (invalidated === 0) {
          return;
        }

        await this.audit.execute({
          accountId: event.accountId,
          actorType: AuditActorType.SYSTEM,
          actorId: null,
          action: AuditAction.CONTENT_APPROVALS_INVALIDATED,
          entityType: 'content',
          entityId: event.contentId,
          // Both hashes: an approver who asks "why did my link stop working?" gets an exact answer.
          payload: {
            previousHash: event.previousHash,
            newHash: event.newHash,
            invalidatedFrom: event.invalidatedFrom,
            requestsInvalidated: invalidated,
          },
        });

        this.logger.warn('Aprovações invalidadas por edição do conteúdo', {
          contentId: event.contentId,
          requestsInvalidated: invalidated,
        });
      });
    } catch (error) {
      // Never breaks the edit. A stale PENDING row is inert: assertUsable refuses it on the hash.
      this.logger.error('Falha ao invalidar aprovações após edição', {
        contentId: event.contentId,
        error: (error as Error)?.message,
      });
    }
  }
}
