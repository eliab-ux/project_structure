import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ReviewChannelQuotaUseCase } from '../../../contexts/channel/application/use-cases/review-channel-quota/review-channel-quota.use-case';
import { ReviewChannelQuotaCommand } from '../../../contexts/channel/application/use-cases/review-channel-quota/review-channel-quota.command';
import { TenantScopedJobRunner } from '../tenant-scoped-job.runner';
import { QUEUE_CHANNEL_QUOTA_REVIEW, ChannelQuotaReviewJobData } from '../queues/queues.constants';

/**
 * One daily throttle review per channel (§2.1).
 *
 * Runs inside TenantScopedJobRunner: the tenant comes from the job payload, the EntityManager is
 * forked per job, and the default-on tenant filter is satisfied the same way an HTTP request
 * satisfies it. Concurrent jobs for different tenants cannot see each other's data.
 *
 * A failure is isolated per channel: one tenant's broken channel must not stop the review of the
 * other 200. BullMQ retries this job alone.
 */
@Processor(QUEUE_CHANNEL_QUOTA_REVIEW)
export class ChannelQuotaReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(ChannelQuotaReviewProcessor.name);

  constructor(
    private readonly runner: TenantScopedJobRunner,
    private readonly reviewQuota: ReviewChannelQuotaUseCase,
  ) {
    super();
  }

  async process(job: Job<ChannelQuotaReviewJobData>): Promise<void> {
    const { accountId, channelId, date } = job.data;

    await this.runner.run(accountId, async () => {
      const result = await this.reviewQuota.execute(
        new ReviewChannelQuotaCommand(accountId, channelId, date),
      );
      this.logger.log('Cota revisada', {
        channelId,
        decision: result.decision,
        from: result.previousQuota,
        to: result.computedQuota,
      });
    });
  }
}
