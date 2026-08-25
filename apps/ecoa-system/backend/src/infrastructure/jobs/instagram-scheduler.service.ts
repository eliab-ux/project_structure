import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ListConnectedTenantsUseCase } from '../../contexts/connection/application/use-cases/list-connected-tenants/list-connected-tenants.use-case';
import {
  QUEUE_CAPTURE_INSIGHTS,
  QUEUE_RECONCILE_MENTIONS,
  QUEUE_REFRESH_TOKEN,
  QUEUE_RESOLVE_WATCHLIST,
  QUEUE_SYNC_MEDIA,
  TenantJobData,
} from './jobs.constants';

/**
 * Fan-out scheduler: each cron sweeps the connected tenants and enqueues ONE child job per
 * tenant, so a tenant with an invalid token never blocks the others and the Graph API load is
 * spread out. Every job downstream is idempotent.
 */
@Injectable()
export class InstagramSchedulerService {
  private readonly logger = new Logger(InstagramSchedulerService.name);

  constructor(
    private readonly listConnectedTenants: ListConnectedTenantsUseCase,
    @InjectQueue(QUEUE_REFRESH_TOKEN) private readonly refreshTokenQueue: Queue,
    @InjectQueue(QUEUE_SYNC_MEDIA) private readonly syncMediaQueue: Queue,
    @InjectQueue(QUEUE_CAPTURE_INSIGHTS) private readonly captureInsightsQueue: Queue,
    @InjectQueue(QUEUE_RESOLVE_WATCHLIST) private readonly resolveWatchlistQueue: Queue,
    @InjectQueue(QUEUE_RECONCILE_MENTIONS) private readonly reconcileMentionsQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduleRefreshTokens(): Promise<void> {
    await this.fanOut(this.refreshTokenQueue, 'refresh-token');
  }

  // Every 2 hours.
  @Cron('0 */2 * * *')
  async scheduleSyncMedia(): Promise<void> {
    await this.fanOut(this.syncMediaQueue, 'sync-media');
  }

  // Every 4 hours.
  @Cron('0 */4 * * *')
  async scheduleCaptureInsights(): Promise<void> {
    await this.fanOut(this.captureInsightsQueue, 'capture-insights');
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduleResolveWatchlist(): Promise<void> {
    await this.fanOut(this.resolveWatchlistQueue, 'resolve-watchlist');
  }

  // Every 6 hours, offset by 30 min so it does not collide with the resolve pass.
  @Cron('30 */6 * * *')
  async scheduleReconcileMentions(): Promise<void> {
    await this.fanOut(this.reconcileMentionsQueue, 'reconcile-mentions');
  }

  private async fanOut(queue: Queue, jobName: string): Promise<void> {
    let tenants: TenantJobData[] = [];
    try {
      tenants = await this.listConnectedTenants.execute();
    } catch (error) {
      this.logger.error(`Não foi possível listar tenants para "${jobName}"`, {
        reason: (error as Error)?.message,
      });
      return;
    }

    for (const tenant of tenants) {
      try {
        await queue.add(jobName, tenant, {
          // Dedup the same tenant within one sweep; safe to retry across sweeps.
          jobId: `${jobName}:${tenant.ownerId}:${this.bucket()}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        });
      } catch (error) {
        // Redis unavailable (e.g. local dev without Redis) must not crash the scheduler.
        this.logger.warn(`Falha ao enfileirar "${jobName}" para tenant`, {
          ownerId: tenant.ownerId,
          reason: (error as Error)?.message,
        });
      }
    }
  }

  /** Coarse time bucket so re-runs within the same hour are de-duplicated by jobId. */
  private bucket(): string {
    return new Date().toISOString().slice(0, 13); // yyyy-mm-ddTHH
  }
}
