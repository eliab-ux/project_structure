import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { AudienceModule } from '../../contexts/audience/audience.module';
import { DispatchModule } from '../../contexts/dispatch/dispatch.module';
import { DistributionModule } from '../../contexts/distribution/distribution.module';
import { ChannelModule } from '../../contexts/channel/channel.module';
import {
  QUEUE_CHANNEL_QUOTA_REVIEW,
  QUEUE_CHANNEL_STATE_SYNC,
  QUEUE_CONTACT_IMPORT,
  QUEUE_DISPATCH,
  QUEUE_DISTRIBUTION_SWEEP,
  QUEUE_SMOKE_TEST,
} from './queues/queues.constants';
import { SmokeTestProcessor } from './workers/smoke-test.processor';
import { ChannelQuotaReviewProcessor } from './workers/channel-quota-review.processor';
import { ChannelStateSyncProcessor } from './workers/channel-state-sync.processor';
import { ContactImportProcessor } from './workers/contact-import.processor';
import { ChannelReviewScheduler } from './channel-review.scheduler';
import { DispatchProcessor } from './workers/dispatch.processor';
import { DistributionSweepProcessor } from './workers/distribution-sweep.processor';
import { DistributionSweepScheduler } from './distribution-sweep.scheduler';
import { TenantScopedJobRunner } from './tenant-scoped-job.runner';

/**
 * Messaging adapter: BullMQ queues (producers), their workers (consumers) and the cron that fans
 * work out. Redis connection options come from AppModule's BullModule.forRootAsync.
 *
 * Note which side of the dispatch queue lives here: the WORKER. The producer (`BullMqDispatchQueue`)
 * is provided by DistributionModule, next to the use case that enqueues. Putting both here would make
 * DistributionModule depend on MessagingModule while MessagingModule already depends on the contexts
 * whose use cases the workers call — a cycle bought for nothing.
 *
 * TenantScopedJobRunner is exported because every tenant-scoped background path needs it — the
 * workers here, and the Evolution webhook, which also runs without a JWT.
 */
@Module({
  imports: [
    ConfigModule,
    ChannelModule,
    AudienceModule,
    DispatchModule,
    // For the sweep scheduler, which reads DISTRIBUTION_REPOSITORY. No cycle: DistributionModule
    // imports the producer CLASS from this folder, not this module.
    DistributionModule,
    BullModule.registerQueue(
      { name: QUEUE_SMOKE_TEST },
      { name: QUEUE_CHANNEL_QUOTA_REVIEW },
      { name: QUEUE_CHANNEL_STATE_SYNC },
      { name: QUEUE_CONTACT_IMPORT },
      { name: QUEUE_DISPATCH },
      { name: QUEUE_DISTRIBUTION_SWEEP },
    ),
  ],
  providers: [
    TenantScopedJobRunner,
    SmokeTestProcessor,
    ChannelQuotaReviewProcessor,
    ChannelStateSyncProcessor,
    ContactImportProcessor,
    ChannelReviewScheduler,
    DispatchProcessor,
    DistributionSweepProcessor,
    DistributionSweepScheduler,
  ],
  exports: [BullModule, TenantScopedJobRunner, ChannelReviewScheduler, DistributionSweepScheduler],
})
export class MessagingModule {}
