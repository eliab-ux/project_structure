import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  DISPATCH_QUEUE,
  DISTRIBUTION_REPOSITORY,
  DispatchQueuePort,
  DistributionRepositoryPort,
} from '../../../../distribution/application/ports/output/distribution-repositories.port';
import { DistributionNotFoundException } from '../../../../distribution/domain/exceptions/distribution-not-found.exception';
import { DistributionControlCommand } from './pause-distribution.command';

export class DistributionControlResultDto {
  distributionId!: string;
  status!: string;
  /** Jobs removed from (or returned to) the queue by this action. */
  jobsAffected!: number;
}

/**
 * PAUSE (§10, FASE 7 item 8).
 *
 * Two steps, and both are needed: the status change stops NEW work being picked up (the worker
 * revalidates and refuses a paused distribution), and removing the queued jobs stops what BullMQ
 * already holds with a delay. Doing only the first would leave thousands of jobs firing and being
 * refused one by one — correct, but noisy; doing only the second would let a re-enqueue resurrect them.
 *
 * `dispatches` rows are NOT touched: they stay PENDING with their `scheduled_at`, because pausing is
 * meant to be undone. That is what makes RESUME cheap.
 */
@Injectable()
export class PauseDistributionUseCase implements UseCase<
  DistributionControlCommand,
  DistributionControlResultDto
> {
  private readonly logger = new Logger(PauseDistributionUseCase.name);

  constructor(
    @Inject(DISTRIBUTION_REPOSITORY) private readonly distributions: DistributionRepositoryPort,
    @Inject(DISPATCH_QUEUE) private readonly queue: DispatchQueuePort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: DistributionControlCommand): Promise<DistributionControlResultDto> {
    const distribution = await this.distributions.findById(command.distributionId);
    if (!distribution) {
      throw new DistributionNotFoundException();
    }

    // Throws when it is not PLANNED/RUNNING — pausing something finished is a bug in the caller.
    distribution.pause();
    const saved = await this.distributions.save(distribution);
    const removed = await this.queue.removePlan(distribution.id);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.DISTRIBUTION_PAUSED,
      entityType: 'distribution',
      entityId: distribution.id,
      ip: command.ip,
      payload: { jobsRemoved: removed },
    });

    this.logger.warn('Distribuição pausada', { distributionId: distribution.id, removed });

    const dto = new DistributionControlResultDto();
    dto.distributionId = saved.id;
    dto.status = saved.status;
    dto.jobsAffected = removed;
    return dto;
  }
}
