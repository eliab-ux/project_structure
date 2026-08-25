import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  DISPATCH_QUEUE,
  DISPATCH_REPOSITORY,
  DISTRIBUTION_REPOSITORY,
  DispatchQueuePort,
  DispatchRepositoryPort,
  DistributionRepositoryPort,
} from '../../../../distribution/application/ports/output/distribution-repositories.port';
import { DispatchStatus } from '../../../../distribution/domain/value-objects/dispatch-status.vo';
import { DistributionNotFoundException } from '../../../../distribution/domain/exceptions/distribution-not-found.exception';
import { DistributionControlCommand } from '../pause-distribution/pause-distribution.command';
import { DistributionControlResultDto } from '../pause-distribution/pause-distribution.use-case';

const ENQUEUE_CHUNK = 500;

/**
 * RESUME (§10, FASE 7 item 8).
 *
 * Re-enqueues the still-PENDING dispatches. Two things about the timing deserve saying:
 *
 *  - **a send whose `scheduled_at` passed while paused goes out immediately** (the delay clamps to
 *    zero). That is intended: the operator paused and un-paused deliberately, and holding those back
 *    would mean a resumed campaign that appears to do nothing.
 *  - **the ceilings still hold**, because the worker re-validates quota and channel state on every
 *    job. A resume at the end of the day does not become a burst — it becomes blocked-by-quota rows,
 *    which is the honest outcome.
 *
 * The job id is the dispatch id, so re-enqueueing something BullMQ still holds is a no-op rather than
 * a duplicate — which is what makes this safe to call twice.
 */
@Injectable()
export class ResumeDistributionUseCase implements UseCase<
  DistributionControlCommand,
  DistributionControlResultDto
> {
  private readonly logger = new Logger(ResumeDistributionUseCase.name);

  constructor(
    @Inject(DISTRIBUTION_REPOSITORY) private readonly distributions: DistributionRepositoryPort,
    @Inject(DISPATCH_REPOSITORY) private readonly dispatches: DispatchRepositoryPort,
    @Inject(DISPATCH_QUEUE) private readonly queue: DispatchQueuePort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: DistributionControlCommand): Promise<DistributionControlResultDto> {
    const distribution = await this.distributions.findById(command.distributionId);
    if (!distribution) {
      throw new DistributionNotFoundException();
    }

    distribution.resume();
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
          scheduledAt: dispatch.scheduledAt ?? new Date(),
        })),
      });
    }

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.DISTRIBUTION_RESUMED,
      entityType: 'distribution',
      entityId: distribution.id,
      ip: command.ip,
      payload: { jobsEnqueued: enqueued, pendingDispatches: pending.data.length },
    });

    this.logger.log('Distribuição retomada', { distributionId: distribution.id, enqueued });

    const dto = new DistributionControlResultDto();
    dto.distributionId = saved.id;
    dto.status = saved.status;
    dto.jobsAffected = enqueued;
    return dto;
  }
}
