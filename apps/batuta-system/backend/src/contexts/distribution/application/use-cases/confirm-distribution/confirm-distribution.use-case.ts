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
import { DispatchStatus } from '../../../domain/value-objects/dispatch-status.vo';
import { DistributionNotFoundException } from '../../../domain/exceptions/distribution-not-found.exception';
import { ContentNotDispatchableException } from '../../../domain/exceptions/content-not-dispatchable.exception';
import { PlanOutdatedException } from '../../../domain/exceptions/plan-outdated.exception';
import { DistributionDto } from '../../dto/distribution.dto';
import {
  DISPATCH_QUEUE,
  DISPATCH_REPOSITORY,
  DISTRIBUTION_REPOSITORY,
  DispatchQueuePort,
  DispatchRepositoryPort,
  DistributionRepositoryPort,
} from '../../ports/output/distribution-repositories.port';
import { ConfirmDistributionCommand } from './confirm-distribution.command';

/** Enqueue in chunks: a 50k-contact plan should not be one enormous pipeline call. */
const ENQUEUE_CHUNK = 500;

/**
 * The operator saw the preview and said yes (§9.3 — "Prévia obrigatória antes de confirmar").
 *
 * This is the ONLY place that enqueues work, and it re-checks the two things that can have changed
 * since the plan was built:
 *
 *  - **the content is still APPROVED.** Editing it after planning invalidates the approval and sends
 *    it back to DRAFT (§8.5). Without this check, confirming would dispatch text nobody approved —
 *    which is precisely the failure §1.4 calls non-negotiable.
 *  - **the hash still matches what the preview showed**, when the caller passes it. Same reason, one
 *    layer more precise: the content could have been edited and re-approved with different wording.
 *
 * The plan itself is NOT rebuilt. The rows in `dispatches` are the plan (§9.2, "O plano é dado, não
 * memória"); re-planning here would mean the operator confirmed one thing and another was queued.
 */
@Injectable()
export class ConfirmDistributionUseCase implements UseCase<
  ConfirmDistributionCommand,
  DistributionDto
> {
  private readonly logger = new Logger(ConfirmDistributionUseCase.name);

  constructor(
    @Inject(DISTRIBUTION_REPOSITORY) private readonly distributions: DistributionRepositoryPort,
    @Inject(DISPATCH_REPOSITORY) private readonly dispatches: DispatchRepositoryPort,
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(DISPATCH_QUEUE) private readonly queue: DispatchQueuePort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ConfirmDistributionCommand): Promise<DistributionDto> {
    const distribution = await this.distributions.findById(command.distributionId);
    if (!distribution) {
      throw new DistributionNotFoundException();
    }

    const content = await this.contents.findById(ContentId.from(distribution.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }
    if (!content.isDispatchable) {
      // The most likely cause is an edit after planning (§8.5), and the message says so.
      throw new ContentNotDispatchableException(content.status);
    }
    if (command.expectedContentHash && command.expectedContentHash !== content.contentHash) {
      // A distinct exception: "está aprovado, mas não é o que você viu" is a different problem from
      // "não está aprovado", and the operator acts differently on each.
      throw new PlanOutdatedException();
    }

    // Throws when it is not DRAFT: confirming twice would enqueue every job again.
    distribution.confirm();
    const saved = await this.distributions.save(distribution);

    const pending = await this.dispatches.listForDistribution(distribution.id, {
      page: 1,
      limit: 100_000,
      status: DispatchStatus.PENDING,
    });

    let enqueued = 0;
    for (let index = 0; index < pending.data.length; index += ENQUEUE_CHUNK) {
      const chunk = pending.data.slice(index, index + ENQUEUE_CHUNK);
      enqueued += await this.queue.enqueuePlan({
        accountId: command.accountId,
        distributionId: distribution.id,
        // From the plan's own snapshot — see the port docblock for why not from the account.
        timeZone: (distribution.config.timeZone as string | undefined) ?? 'America/Sao_Paulo',
        dispatches: chunk.map((dispatch) => ({
          dispatchId: dispatch.id,
          // Non-null for PENDING rows by construction; the fallback keeps the type honest.
          scheduledAt: dispatch.scheduledAt ?? new Date(),
        })),
      });
    }

    await this.events.publishAll(saved.pullDomainEvents());

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.DISTRIBUTION_CONFIRMED,
      entityType: 'distribution',
      entityId: distribution.id,
      ip: command.ip,
      payload: {
        contentId: content.id.value,
        contentHash: content.contentHash,
        dispatchesQueued: enqueued,
        pendingDispatches: pending.data.length,
      },
    });

    this.logger.log('Distribuição confirmada', {
      distributionId: distribution.id,
      enqueued,
    });

    return DistributionDto.fromDomain(saved, content.title);
  }
}
