import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  DISTRIBUTION_REPOSITORY,
  DistributionRepositoryPort,
} from '../../contexts/distribution/application/ports/output/distribution-repositories.port';
import { DistributionSweepJobData, QUEUE_DISTRIBUTION_SWEEP } from './queues/queues.constants';
import { TenantScopedJobRunner } from './tenant-scoped-job.runner';

/**
 * Asks, every ten minutes, whether any live distribution has finished its work.
 *
 * Same shape as the channel review of FASE 2, for the same reasons: this scheduler is one of the very
 * few places that legitimately crosses tenants, it does so through a method that returns identities
 * only (`listActiveIds`), and each job establishes its own tenant scope before touching business data.
 *
 * Ten minutes is chosen against what the delay costs: nothing operational depends on the exact moment
 * a campaign flips to COMPLETED — it is a label on a screen and an audit line. Polling every minute
 * would multiply queries across every tenant to make a status badge ten minutes fresher.
 *
 * The job id is `sweep:{distributionId}:{tenMinuteBucket}` so an overlapping tick cannot enqueue the
 * same check twice, while the next bucket still gets its own job.
 */
@Injectable()
export class DistributionSweepScheduler {
  private readonly logger = new Logger(DistributionSweepScheduler.name);

  constructor(
    @Inject(DISTRIBUTION_REPOSITORY) private readonly distributions: DistributionRepositoryPort,
    @InjectQueue(QUEUE_DISTRIBUTION_SWEEP) private readonly queue: Queue<DistributionSweepJobData>,
    private readonly jobs: TenantScopedJobRunner,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'distribution-sweep' })
  async sweep(): Promise<void> {
    // A cron has no request, so the shared EntityManager is refused by MikroORM. `runUnscoped` gives
    // this tick its own fork; the read below is identity-only and each enqueued job establishes its
    // own tenant scope.
    const targets = await this.jobs.runUnscoped(() => this.distributions.listActiveIds());
    if (targets.length === 0) {
      return;
    }

    const bucket = Math.floor(Date.now() / 600_000);
    let enqueued = 0;
    for (const target of targets) {
      await this.queue.add(
        'sweep',
        { accountId: target.accountId, distributionId: target.distributionId },
        {
          // Separator is `-`, not `:`. BullMQ REJECTS a custom id containing a colon — it is the
          // separator of its own Redis keys — and the rejection happens inside the cron, where the
          // only trace is a log line. A colon here means the sweep silently never runs.
          jobId: `sweep-${target.distributionId}-${bucket}`,
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
      enqueued += 1;
    }

    this.logger.debug('Varredura de distribuições enfileirada', { enqueued });
  }
}
