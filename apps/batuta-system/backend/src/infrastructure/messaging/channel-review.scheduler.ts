import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../contexts/channel/application/ports/output/channel-repository.port';
import { MikroOrmDailySendUsage } from '../persistence/daily-send-usage.adapter';
import {
  QUEUE_CHANNEL_QUOTA_REVIEW,
  QUEUE_CHANNEL_STATE_SYNC,
  ChannelJobData,
  ChannelQuotaReviewJobData,
} from './queues/queues.constants';
import { TenantScopedJobRunner } from './tenant-scoped-job.runner';

/**
 * Fans the daily review out, one job per channel (§2.1: "Revisão diária por canal (job agendado)").
 *
 * The scheduler itself is the ONE place that legitimately crosses tenants — it has to, to reach
 * every account — and it does so through `listAllForDailyReview()`, which returns identities only.
 * Each job then establishes its own tenant scope. No business data is read here.
 *
 * Job ids are deterministic (`channel:date`), so a restart, an overlapping tick or a manual trigger
 * cannot produce two reviews of the same channel for the same day.
 */
@Injectable()
export class ChannelReviewScheduler {
  private readonly logger = new Logger(ChannelReviewScheduler.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @InjectQueue(QUEUE_CHANNEL_QUOTA_REVIEW) private readonly reviewQueue: Queue,
    @InjectQueue(QUEUE_CHANNEL_STATE_SYNC) private readonly syncQueue: Queue,
    private readonly runner: TenantScopedJobRunner,
    private readonly config: ConfigService,
  ) {}

  /**
   * 03:10 every day. Late enough that the closing day is really over in Brazilian timezones, and
   * off the hour so it does not pile onto every other cron in the world.
   */
  @Cron('10 3 * * *', { name: 'channel-quota-review' })
  async scheduleDailyReview(): Promise<void> {
    // Own ORM fork: a cron has no request, and MikroORM refuses the shared EntityManager. The read is
    // identity-only; each enqueued job establishes its own tenant scope.
    const targets = await this.runner.runUnscoped(() => this.channels.listAllForDailyReview());
    if (targets.length === 0) {
      this.logger.debug('Nenhum canal ativo para revisar');
      return;
    }

    // The day being closed is yesterday in the tenant's own timezone. Resolving it per channel would
    // need the account, so the scheduler uses the platform default and the use case receives it
    // explicitly — the account timezone matters for the counters, which are already stored per day.
    const timezone = this.config.get<string>('DEFAULT_TIMEZONE') ?? 'America/Sao_Paulo';
    const date = ChannelReviewScheduler.yesterdayIn(timezone);

    let enqueued = 0;
    for (const target of targets) {
      const data: ChannelQuotaReviewJobData = { ...target, date };
      await this.reviewQueue.add('review', data, {
        // `-`, never `:` — BullMQ rejects a colon in a custom id (it separates its own Redis keys),
        // and the rejection surfaces only as a log line inside the cron.
        jobId: `${target.channelId}-${date}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 500,
        removeOnFail: 500,
      });
      enqueued += 1;
    }

    this.logger.log('Revisão diária de cota enfileirada', { channels: enqueued, date });
  }

  /** Every 15 minutes: cheap, and it is what keeps a missed webhook from going unnoticed for a day. */
  @Cron('*/15 * * * *', { name: 'channel-state-sync' })
  async scheduleStateSync(): Promise<void> {
    const targets = await this.runner.runUnscoped(() => this.channels.listAllForDailyReview());

    for (const target of targets) {
      const data: ChannelJobData = target;
      await this.syncQueue.add('sync', data, {
        // One pending reconciliation per channel is enough; a backlog would just re-ask the same
        // question. The id is stable within the tick window.
        jobId: `${target.channelId}-${Math.floor(Date.now() / 900_000)}`,
        attempts: 2,
        removeOnComplete: 200,
        removeOnFail: 200,
      });
    }
  }

  /**
   * Manual trigger for one channel, used by the operator screen and by support. Goes through the
   * same queue and the same deterministic id, so it cannot double-review a day.
   */
  async triggerReview(accountId: string, channelId: string, date: string): Promise<void> {
    await this.runner.run(accountId, async () => {
      const data: ChannelQuotaReviewJobData = { accountId, channelId, date };
      await this.reviewQueue.add('review', data, { jobId: `${channelId}-${date}` });
    });
  }

  private static yesterdayIn(timezone: string): string {
    const today = MikroOrmDailySendUsage.todayIn(timezone);
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }
}
