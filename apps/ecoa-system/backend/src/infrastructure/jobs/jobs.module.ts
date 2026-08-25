import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConnectionModule } from '../../contexts/connection/connection.module';
import { ContentModule } from '../../contexts/content/content.module';
import { InsightModule } from '../../contexts/insight/insight.module';
import { WatchlistModule } from '../../contexts/watchlist/watchlist.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import {
  QUEUE_CAPTURE_INSIGHTS,
  QUEUE_RECONCILE_MENTIONS,
  QUEUE_REFRESH_TOKEN,
  QUEUE_RESOLVE_WATCHLIST,
  QUEUE_SYNC_MEDIA,
} from './jobs.constants';
import { InstagramSchedulerService } from './instagram-scheduler.service';
import { RefreshTokenProcessor } from './processors/refresh-token.processor';
import { SyncMediaProcessor } from './processors/sync-media.processor';
import { CaptureInsightsProcessor } from './processors/capture-insights.processor';
import { ResolveWatchlistProcessor } from './processors/resolve-watchlist.processor';
import { ReconcileMentionsProcessor } from './processors/reconcile-mentions.processor';

/**
 * Background jobs (BullMQ + Redis). The scheduler fans out one child job per connected tenant;
 * each processor resolves the tenant's decrypted token and calls the relevant use case. All jobs
 * are idempotent and isolate per-tenant failures.
 */
@Module({
  imports: [
    ConnectionModule,
    ContentModule,
    InsightModule,
    WatchlistModule,
    IngestionModule,
    BullModule.registerQueue(
      { name: QUEUE_REFRESH_TOKEN },
      { name: QUEUE_SYNC_MEDIA },
      { name: QUEUE_CAPTURE_INSIGHTS },
      { name: QUEUE_RESOLVE_WATCHLIST },
      { name: QUEUE_RECONCILE_MENTIONS },
    ),
  ],
  providers: [
    InstagramSchedulerService,
    RefreshTokenProcessor,
    SyncMediaProcessor,
    CaptureInsightsProcessor,
    ResolveWatchlistProcessor,
    ReconcileMentionsProcessor,
  ],
})
export class JobsModule {}
