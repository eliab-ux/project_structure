import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import { Job } from 'bullmq';
import { GetActiveConnectionUseCase } from '../../../contexts/connection/application/use-cases/get-active-connection/get-active-connection.use-case';
import { SyncOwnMediaUseCase } from '../../../contexts/content/application/use-cases/sync-own-media/sync-own-media.use-case';
import { SyncOwnMediaCommand } from '../../../contexts/content/application/use-cases/sync-own-media/sync-own-media.command';
import { QUEUE_SYNC_MEDIA, TenantJobData } from '../jobs.constants';

@Processor(QUEUE_SYNC_MEDIA)
export class SyncMediaProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncMediaProcessor.name);

  constructor(
    private readonly getActiveConnection: GetActiveConnectionUseCase,
    private readonly syncOwnMedia: SyncOwnMediaUseCase,
    private readonly orm: MikroORM,
  ) {
    super();
  }

  @CreateRequestContext((t: SyncMediaProcessor) => t.orm)
  async process(job: Job<TenantJobData>): Promise<void> {
    const { ownerId } = job.data;
    const connection = await this.getActiveConnection.execute({ ownerId });
    if (!connection) {
      return;
    }
    const result = await this.syncOwnMedia.execute(
      new SyncOwnMediaCommand(ownerId, connection.igUserId, connection.accessToken),
    );
    this.logger.log('Sync de mídias processado', { ownerId, synced: result.synced });
  }
}
