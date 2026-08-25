import { Inject, Injectable, Logger } from '@nestjs/common';
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
  DISPATCH_REPOSITORY,
  DISTRIBUTION_REPOSITORY,
  DispatchRepositoryPort,
  DistributionRepositoryPort,
} from '../../../../distribution/application/ports/output/distribution-repositories.port';
import { DistributionCompletedEvent } from '../../../../distribution/domain/events/distribution-completed.event';

/**
 * Closes distributions whose work is finished.
 *
 * Why a sweep rather than "the last worker closes it": there is no reliable last worker. A dispatch can
 * end as SENT, FAILED, CANCELLED or BLOCKED, from three different code paths, and one of them is a
 * worker that crashed mid-job. Making each of them check "am I the last one?" is a race with an
 * expensive wrong answer — a campaign that never reports finishing, or one that reports finishing
 * twice. A periodic check over the counts has neither problem.
 *
 * PAUSED distributions are deliberately skipped even when nothing is pending: paused means a human
 * intends to come back, and auto-completing it would take that decision away.
 */
@Injectable()
export class CloseFinishedDistributionsUseCase {
  private readonly logger = new Logger(CloseFinishedDistributionsUseCase.name);

  constructor(
    @Inject(DISTRIBUTION_REPOSITORY) private readonly distributions: DistributionRepositoryPort,
    @Inject(DISPATCH_REPOSITORY) private readonly dispatches: DispatchRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  /** Runs inside a tenant scope already established by the caller. */
  async closeOne(accountId: string, distributionId: string): Promise<boolean> {
    const distribution = await this.distributions.findById(distributionId);
    if (!distribution || !distribution.isDispatchable) {
      // Not dispatchable covers PAUSED, CANCELLED and COMPLETED — none of which this should touch.
      return false;
    }

    const counts = await this.dispatches.countsFor(distribution.id);
    if (counts.pending > 0 || counts.sending > 0) {
      return false;
    }

    distribution.complete();
    await this.distributions.save(distribution);

    await this.events.publish(
      new DistributionCompletedEvent(accountId, distribution.id, counts.sent, counts.failed),
    );

    await this.audit.execute({
      accountId,
      actorType: AuditActorType.SYSTEM,
      actorId: null,
      action: AuditAction.DISTRIBUTION_COMPLETED,
      entityType: 'distribution',
      entityId: distribution.id,
      ip: null,
      // The final tally, in the trail: it is the summary line of the exported report (§11 item 2).
      payload: {
        sent: counts.sent,
        failed: counts.failed,
        blocked: counts.blocked,
        cancelled: counts.cancelled,
        total: counts.total,
      },
    });

    this.logger.log('Distribuição concluída', {
      distributionId: distribution.id,
      sent: counts.sent,
      failed: counts.failed,
    });
    return true;
  }
}
