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
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  DISPATCH_QUEUE,
  DISPATCH_REPOSITORY,
  DISTRIBUTION_REPOSITORY,
  DispatchQueuePort,
  DispatchRepositoryPort,
  DistributionRepositoryPort,
} from '../../../../distribution/application/ports/output/distribution-repositories.port';
import { DistributionNotFoundException } from '../../../../distribution/domain/exceptions/distribution-not-found.exception';
import { DistributionControlCommand } from '../pause-distribution/pause-distribution.command';
import { DistributionControlResultDto } from '../pause-distribution/pause-distribution.use-case';

/**
 * CANCEL — "cancela pendentes, preserva enviados" (§10, FASE 7 item 8).
 *
 * The second half of that sentence is the important one. What already went out cannot be un-sent, and
 * rewriting those rows would corrupt the exported report that §11 item 2 calls the artefact answering
 * external questioning. So SENT rows are left exactly as they are, and only PENDING/SENDING become
 * CANCELLED.
 *
 * BLOCKED rows are also left alone: they carry a reason that explains itself, and overwriting it with
 * "cancelled" would destroy the answer to "why did these people not receive it?".
 *
 * Terminal and irreversible: there is no un-cancel. Resuming a cancelled campaign means planning a new
 * one, which is the honest way to do it — the audience, the quotas and the content may all have moved.
 */
@Injectable()
export class CancelDistributionUseCase implements UseCase<
  DistributionControlCommand,
  DistributionControlResultDto
> {
  private readonly logger = new Logger(CancelDistributionUseCase.name);

  constructor(
    @Inject(DISTRIBUTION_REPOSITORY) private readonly distributions: DistributionRepositoryPort,
    @Inject(DISPATCH_REPOSITORY) private readonly dispatches: DispatchRepositoryPort,
    @Inject(DISPATCH_QUEUE) private readonly queue: DispatchQueuePort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: DistributionControlCommand): Promise<DistributionControlResultDto> {
    const distribution = await this.distributions.findById(command.distributionId);
    if (!distribution) {
      throw new DistributionNotFoundException();
    }

    distribution.cancel(command.reason);

    let cancelledRows = 0;
    await this.unitOfWork.execute(async () => {
      await this.distributions.save(distribution);
      // SENT and BLOCKED are untouched by this method — see the class docblock.
      cancelledRows = await this.dispatches.cancelPendingFor(distribution.id);
    });

    // Outside the transaction: a queue that is unreachable must not roll back a cancellation the
    // operator asked for. The status change alone already stops every job from sending.
    const removed = await this.queue.removePlan(distribution.id);
    await this.events.publishAll(distribution.pullDomainEvents());

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.DISTRIBUTION_CANCELLED,
      entityType: 'distribution',
      entityId: distribution.id,
      ip: command.ip,
      payload: { reason: command.reason, dispatchesCancelled: cancelledRows, jobsRemoved: removed },
    });

    this.logger.warn('Distribuição cancelada', {
      distributionId: distribution.id,
      cancelledRows,
      removed,
    });

    const dto = new DistributionControlResultDto();
    dto.distributionId = distribution.id;
    dto.status = distribution.status;
    dto.jobsAffected = cancelledRows;
    return dto;
  }
}
