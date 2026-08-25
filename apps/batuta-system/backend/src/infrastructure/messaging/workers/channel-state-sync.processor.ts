import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SyncConnectionStateUseCase } from '../../../contexts/channel/application/use-cases/sync-connection-state/sync-connection-state.use-case';
import { SyncConnectionStateCommand } from '../../../contexts/channel/application/use-cases/sync-connection-state/sync-connection-state.command';
import { TenantScopedJobRunner } from '../tenant-scoped-job.runner';
import { QUEUE_CHANNEL_STATE_SYNC, ChannelJobData } from '../queues/queues.constants';

/**
 * Reconciles `channels.status` with what the Evolution instance actually reports.
 *
 * Necessary because a webhook can be missed — server restart, network blip, an instance created
 * before the webhook was configured. A chip that is silently DISCONNECTED in our database while
 * being CONNECTED in reality (or the reverse) breaks planning: dispatches would be blocked for no
 * reason, or planned against a chip that cannot send.
 */
@Processor(QUEUE_CHANNEL_STATE_SYNC)
export class ChannelStateSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(ChannelStateSyncProcessor.name);

  constructor(
    private readonly runner: TenantScopedJobRunner,
    private readonly syncState: SyncConnectionStateUseCase,
  ) {
    super();
  }

  async process(job: Job<ChannelJobData>): Promise<void> {
    const { accountId, channelId } = job.data;

    await this.runner.run(accountId, async () => {
      const channel = await this.syncState.execute(
        new SyncConnectionStateCommand(accountId, channelId),
      );
      this.logger.debug('Estado reconciliado', { channelId, status: channel.status });
    });
  }
}
