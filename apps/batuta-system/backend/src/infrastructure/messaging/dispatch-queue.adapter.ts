import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DispatchQueuePort } from '../../contexts/distribution/application/ports/output/distribution-repositories.port';
import { DispatchJobData, QUEUE_DISPATCH } from './queues/queues.constants';

/**
 * Keep completed/failed jobs around long enough to debug a campaign, not forever: a 10k-send campaign
 * would otherwise leave 10k job records in Redis per run.
 */
const KEEP_COMPLETED = 1_000;
const KEEP_FAILED = 5_000;

/**
 * The real dispatch queue (§10, FASE 7 item 1), replacing the FASE 6 no-op.
 *
 * Three details carry the weight:
 *
 *  1. **`jobId` is the dispatch id.** That is the idempotency guarantee the spec asks for: enqueueing
 *     the same dispatch twice is a no-op in BullMQ, so a re-confirm, a resume, or a retry of the
 *     enqueue itself cannot produce two messages to the same person.
 *  2. **The delay comes from `scheduled_at`**, clamped at zero. The pacing decided by the planner
 *     (§9.2) is expressed as job delays rather than as a worker that sleeps — a sleeping worker holds a
 *     connection and forgets everything if the process restarts.
 *  3. **`attempts` and backoff are set here**, and a permanent failure does not consume them: the use
 *     case marks the dispatch FAILED and returns normally, so BullMQ sees a success and never retries.
 *     Retrying is triggered by throwing, which the processor does only for transient failures.
 */
@Injectable()
export class BullMqDispatchQueue implements DispatchQueuePort {
  private readonly logger = new Logger(BullMqDispatchQueue.name);

  constructor(@InjectQueue(QUEUE_DISPATCH) private readonly queue: Queue<DispatchJobData>) {}

  async enqueuePlan(input: {
    accountId: string;
    distributionId: string;
    dispatches: readonly { dispatchId: string; scheduledAt: Date }[];
    timeZone: string;
  }): Promise<number> {
    if (input.dispatches.length === 0) {
      return 0;
    }

    const now = Date.now();
    const jobs = input.dispatches.map((dispatch) => ({
      name: 'send',
      data: {
        accountId: input.accountId,
        distributionId: input.distributionId,
        dispatchId: dispatch.dispatchId,
        timeZone: input.timeZone,
      },
      opts: {
        // The dispatch id, so a duplicate enqueue is silently ignored rather than duplicated.
        jobId: dispatch.dispatchId,
        delay: Math.max(0, dispatch.scheduledAt.getTime() - now),
        attempts: 5,
        backoff: { type: 'exponential' as const, delay: 30_000 },
        removeOnComplete: KEEP_COMPLETED,
        removeOnFail: KEEP_FAILED,
      },
    }));

    await this.queue.addBulk(jobs);
    this.logger.log('Envios enfileirados', {
      distributionId: input.distributionId,
      jobs: jobs.length,
    });
    return jobs.length;
  }

  /**
   * Removes what has not run yet (pause and cancel).
   *
   * Only delayed and waiting jobs: an ACTIVE job is mid-send and killing it would leave a dispatch in
   * SENDING with a message possibly already delivered. It is allowed to finish, and the status change
   * on the distribution stops everything after it.
   */
  async removePlan(distributionId: string): Promise<number> {
    const jobs = await this.queue.getJobs(['delayed', 'waiting', 'paused'], 0, 100_000);
    let removed = 0;
    for (const job of jobs) {
      if (job.data?.distributionId !== distributionId) {
        continue;
      }
      try {
        await job.remove();
        removed += 1;
      } catch {
        // A job that started running between the listing and this call cannot be removed. Not a
        // failure: the worker will refuse it on revalidation.
      }
    }
    this.logger.warn('Jobs de envio removidos da fila', { distributionId, removed });
    return removed;
  }
}
