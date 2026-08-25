import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import { Job } from 'bullmq';
import { RefreshConnectionTokenUseCase } from '../../../contexts/connection/application/use-cases/refresh-connection-token/refresh-connection-token.use-case';
import { QUEUE_REFRESH_TOKEN, TenantJobData } from '../jobs.constants';

@Processor(QUEUE_REFRESH_TOKEN)
export class RefreshTokenProcessor extends WorkerHost {
  private readonly logger = new Logger(RefreshTokenProcessor.name);

  constructor(
    private readonly refreshConnectionToken: RefreshConnectionTokenUseCase,
    private readonly orm: MikroORM,
  ) {
    super();
  }

  // Each job runs in its own MikroORM context (forked EM) — workers have no request scope.
  @CreateRequestContext((t: RefreshTokenProcessor) => t.orm)
  async process(job: Job<TenantJobData>): Promise<void> {
    const { ownerId } = job.data;
    const result = await this.refreshConnectionToken.execute({ ownerId });
    this.logger.log('Renovação de token processada', { ownerId, status: result.status });
  }
}
