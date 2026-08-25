import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_SMOKE_TEST, SmokeTestJobData } from '../queues/queues.constants';

/**
 * FASE 0 smoke test: proves Redis + BullMQ are wired end to end (producer → queue → worker).
 * Real workers (dispatch, imports, throttle review) arrive with their phases.
 */
@Processor(QUEUE_SMOKE_TEST)
export class SmokeTestProcessor extends WorkerHost {
  private readonly logger = new Logger(SmokeTestProcessor.name);

  async process(job: Job<SmokeTestJobData>): Promise<{ processedAt: string }> {
    this.logger.log('Smoke-test job processado', { jobId: job.id, label: job.data.label });
    return { processedAt: new Date().toISOString() };
  }
}
