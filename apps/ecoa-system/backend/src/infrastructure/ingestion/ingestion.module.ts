import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { WebhookEventOrmEntity } from '../persistence/mikro-orm/entities/webhook-event-orm.entity';
import { WatchlistModule } from '../../contexts/watchlist/watchlist.module';
import { ContentModule } from '../../contexts/content/content.module';
import { DetectionModule } from '../../contexts/detection/detection.module';
import { DetectionIngestionService } from './detection-ingestion.service';

/**
 * Shared detection-ingestion path (webhook + reconcile job). Imports the contexts whose ports it
 * orchestrates and owns the webhook_event dedup table.
 */
@Module({
  imports: [
    MikroOrmModule.forFeature([WebhookEventOrmEntity]),
    WatchlistModule,
    ContentModule,
    DetectionModule,
  ],
  providers: [DetectionIngestionService],
  exports: [DetectionIngestionService],
})
export class IngestionModule {}
