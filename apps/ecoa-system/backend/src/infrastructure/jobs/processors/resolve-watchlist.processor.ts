import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import { Job } from 'bullmq';
import { GetActiveConnectionUseCase } from '../../../contexts/connection/application/use-cases/get-active-connection/get-active-connection.use-case';
import { ResolveWatchlistUseCase } from '../../../contexts/watchlist/application/use-cases/resolve-watchlist/resolve-watchlist.use-case';
import { ResolveWatchlistCommand } from '../../../contexts/watchlist/application/use-cases/resolve-watchlist/resolve-watchlist.command';
import { QUEUE_RESOLVE_WATCHLIST, TenantJobData } from '../jobs.constants';

@Processor(QUEUE_RESOLVE_WATCHLIST)
export class ResolveWatchlistProcessor extends WorkerHost {
  private readonly logger = new Logger(ResolveWatchlistProcessor.name);

  constructor(
    private readonly getActiveConnection: GetActiveConnectionUseCase,
    private readonly resolveWatchlist: ResolveWatchlistUseCase,
    private readonly orm: MikroORM,
  ) {
    super();
  }

  @CreateRequestContext((t: ResolveWatchlistProcessor) => t.orm)
  async process(job: Job<TenantJobData>): Promise<void> {
    const { ownerId } = job.data;
    const connection = await this.getActiveConnection.execute({ ownerId });
    if (!connection) {
      return;
    }
    const result = await this.resolveWatchlist.execute(
      new ResolveWatchlistCommand(ownerId, connection.accessToken),
    );
    this.logger.log('Resolução da watchlist processada', { ownerId, resolved: result.resolved });
  }
}
