import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CloseFinishedDistributionsUseCase } from '../../../contexts/dispatch/application/use-cases/sweep-distributions/close-finished-distributions.use-case';
import { TenantScopedJobRunner } from '../tenant-scoped-job.runner';
import { DistributionSweepJobData, QUEUE_DISTRIBUTION_SWEEP } from '../queues/queues.constants';

/** Closes one distribution if its work is done. One job per distribution, so a failure is isolated. */
@Processor(QUEUE_DISTRIBUTION_SWEEP)
export class DistributionSweepProcessor extends WorkerHost {
  private readonly logger = new Logger(DistributionSweepProcessor.name);

  constructor(
    private readonly runner: TenantScopedJobRunner,
    private readonly closeFinished: CloseFinishedDistributionsUseCase,
  ) {
    super();
  }

  async process(job: Job<DistributionSweepJobData>): Promise<void> {
    const { accountId, distributionId } = job.data;

    const closed = await this.runner.run(accountId, () =>
      this.closeFinished.closeOne(accountId, distributionId),
    );

    if (closed) {
      this.logger.log('Distribuição fechada pela varredura', { distributionId });
    }
  }
}
