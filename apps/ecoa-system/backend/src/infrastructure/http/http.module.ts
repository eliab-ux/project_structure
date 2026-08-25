import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_CAPTURE_INSIGHTS, QUEUE_SYNC_MEDIA } from '../jobs/jobs.constants';
// Context modules (each exports the use cases its controller injects)
import { UserModule } from '../../contexts/user/user.module';
import { AuthModule } from '../../contexts/auth/auth.module';
import { ConnectionModule } from '../../contexts/connection/connection.module';
import { WatchlistModule } from '../../contexts/watchlist/watchlist.module';
import { ContentModule } from '../../contexts/content/content.module';
import { InsightModule } from '../../contexts/insight/insight.module';
import { DetectionModule } from '../../contexts/detection/detection.module';
import { IngestionModule } from '../ingestion/ingestion.module';
// Controllers
import { AuthController } from './controllers/auth/auth.controller';
import { ConnectionController } from './controllers/connection/connection.controller';
import { WatchlistController } from './controllers/watchlist/watchlist.controller';
import { MediaController } from './controllers/media/media.controller';
import { MediaInsightsController } from './controllers/media-insights/media-insights.controller';
import { DetectionController } from './controllers/detection/detection.controller';
import { InstagramWebhookController } from './controllers/webhook/instagram-webhook.controller';
import { InstagramWebhookService } from './controllers/webhook/instagram-webhook.service';
import { HealthController } from './controllers/health/health.controller';

/**
 * The HTTP adapter: wires every controller to the use cases exported by the bounded contexts.
 * The webhook is the only public route (verified by signature, not JWT).
 */
@Module({
  imports: [
    ConfigModule,
    UserModule,
    AuthModule,
    ConnectionModule,
    WatchlistModule,
    ContentModule,
    InsightModule,
    DetectionModule,
    IngestionModule,
    // Producer-side access to the sync/capture queues so a fresh connection can trigger an
    // immediate refresh instead of waiting for the next scheduled sweep. Workers live in JobsModule.
    BullModule.registerQueue({ name: QUEUE_SYNC_MEDIA }, { name: QUEUE_CAPTURE_INSIGHTS }),
  ],
  controllers: [
    HealthController,
    AuthController,
    ConnectionController,
    WatchlistController,
    MediaController,
    MediaInsightsController,
    DetectionController,
    InstagramWebhookController,
  ],
  providers: [InstagramWebhookService],
})
export class HttpModule {}
