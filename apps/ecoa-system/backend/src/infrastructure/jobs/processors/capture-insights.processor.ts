import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import { Job } from 'bullmq';
import { GetActiveConnectionUseCase } from '../../../contexts/connection/application/use-cases/get-active-connection/get-active-connection.use-case';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../../contexts/content/application/ports/output/content-repository.port';
import { CaptureInsightsUseCase } from '../../../contexts/insight/application/use-cases/capture-insights/capture-insights.use-case';
import { CaptureInsightsCommand } from '../../../contexts/insight/application/use-cases/capture-insights/capture-insights.command';
import { QUEUE_CAPTURE_INSIGHTS, TenantJobData } from '../jobs.constants';

@Processor(QUEUE_CAPTURE_INSIGHTS)
export class CaptureInsightsProcessor extends WorkerHost {
  private readonly logger = new Logger(CaptureInsightsProcessor.name);
  private static readonly RECENT_MEDIA_LIMIT = 25;

  constructor(
    private readonly getActiveConnection: GetActiveConnectionUseCase,
    @Inject(CONTENT_REPOSITORY) private readonly contentRepository: ContentRepositoryPort,
    private readonly captureInsights: CaptureInsightsUseCase,
    private readonly orm: MikroORM,
  ) {
    super();
  }

  @CreateRequestContext((t: CaptureInsightsProcessor) => t.orm)
  async process(job: Job<TenantJobData>): Promise<void> {
    const { ownerId } = job.data;
    const connection = await this.getActiveConnection.execute({ ownerId });
    if (!connection) {
      return;
    }
    const recent = await this.contentRepository.findRecentByOwner(
      ownerId,
      CaptureInsightsProcessor.RECENT_MEDIA_LIMIT,
    );
    if (recent.length === 0) {
      return;
    }
    const media = recent.map((m) => ({ ownMediaId: m.id.value, igMediaId: m.igMediaId }));
    const result = await this.captureInsights.execute(
      new CaptureInsightsCommand(ownerId, connection.accessToken, media),
    );
    this.logger.log('Captura de insights processada', { ownerId, captured: result.captured });
  }
}
