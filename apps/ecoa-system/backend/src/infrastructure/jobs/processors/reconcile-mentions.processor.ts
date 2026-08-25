import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import { Job } from 'bullmq';
import { GetActiveConnectionUseCase } from '../../../contexts/connection/application/use-cases/get-active-connection/get-active-connection.use-case';
import {
  INSTAGRAM_GATEWAY,
  InstagramGatewayPort,
} from '../../integrations/instagram/ports/instagram-gateway.port';
import { DetectionType } from '../../../contexts/detection/domain/value-objects/detection-type.vo';
import { DetectionIngestionService } from '../../ingestion/detection-ingestion.service';
import { QUEUE_RECONCILE_MENTIONS, TenantJobData } from '../jobs.constants';

/**
 * Safety net: re-reads the mentions/tags edge for a tenant in case a webhook delivery was lost.
 * Idempotent — the ingestion service dedups by a deterministic externalId, so a mention already
 * captured (via webhook or a prior reconcile) is never duplicated.
 */
@Processor(QUEUE_RECONCILE_MENTIONS)
export class ReconcileMentionsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReconcileMentionsProcessor.name);

  constructor(
    private readonly getActiveConnection: GetActiveConnectionUseCase,
    @Inject(INSTAGRAM_GATEWAY) private readonly gateway: InstagramGatewayPort,
    private readonly ingestion: DetectionIngestionService,
    private readonly orm: MikroORM,
  ) {
    super();
  }

  @CreateRequestContext((t: ReconcileMentionsProcessor) => t.orm)
  async process(job: Job<TenantJobData>): Promise<void> {
    const { ownerId } = job.data;
    const connection = await this.getActiveConnection.execute({ ownerId });
    if (!connection) {
      return;
    }

    const mentions = await this.gateway.fetchMentions(connection.igUserId, connection.accessToken);
    let ingested = 0;
    for (const mention of mentions) {
      const key = mention.permalink ?? mention.mediaId ?? mention.mentionedAt.toISOString();
      await this.ingestion.ingest({
        ownerId,
        sourceUsername: mention.sourceUsername.toLowerCase(),
        // fetchMentions reads the /tags edge, so every row it returns is a tag.
        detectionType: DetectionType.TAG,
        igMediaId: mention.mediaId,
        permalink: mention.permalink,
        detectedAt: mention.mentionedAt,
        externalId: `mention:${ownerId}:${key}`,
      });
      ingested += 1;
    }
    this.logger.log('Reconciliação de menções processada', { ownerId, scanned: ingested });
  }
}
