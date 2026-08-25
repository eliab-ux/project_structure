import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { DelayedError, Job, UnrecoverableError } from 'bullmq';
import { ExecuteDispatchUseCase } from '../../../contexts/dispatch/application/use-cases/execute-dispatch/execute-dispatch.use-case';
import { ExecuteDispatchCommand } from '../../../contexts/dispatch/application/use-cases/execute-dispatch/execute-dispatch.command';
import { TenantScopedJobRunner } from '../tenant-scoped-job.runner';
import { DispatchJobData, QUEUE_DISPATCH } from '../queues/queues.constants';

/**
 * Spread added when a deferred job is rescheduled.
 *
 * Short on purpose: it only has to break the tie between jobs of the same channel that woke together,
 * not to add pacing — the interval already does that.
 */
const DEFERRAL_JITTER_MS = 5_000;

/**
 * One send per job (§10, FASE 7).
 *
 * The processor is deliberately thin: claim, delegate, translate the outcome into what BullMQ needs to
 * hear. Everything that decides anything lives in the use case, which is testable without Redis.
 *
 * How the outcome maps to the queue, and why each mapping is the one it is:
 *
 *  - **SENT / BLOCKED → return normally.** Both are final and both are non-events for the queue.
 *    Marking a revalidation refusal as a job failure would fill the failed list with correct
 *    behaviour: an opted-out contact is not an error, it is the system obeying §6.5.
 *  - **FAILED → `UnrecoverableError`.** Final too, but it IS a failure worth seeing. Throwing this
 *    specific error tells BullMQ to stop without consuming the remaining attempts, so an operator
 *    reading the queue sees the same verdict the dispatch row carries.
 *  - **RETRY → throw a plain error.** That is the only way to ask for the exponential backoff
 *    configured on the job. The dispatch is already back in PENDING, so the retry finds it claimable.
 *  - **A crash before the use case returns** leaves the row in SENDING; the use case's own catch
 *    releases it, and if the process died outright the sweep will not close the distribution, which is
 *    the visible symptom rather than a silent hole.
 *
 * Concurrency stays at BullMQ's default of one per worker process, but the REASON changed and the old
 * one was wrong (Adendo 02 §1.1). It used to be recorded here as what prevented a post-restart burst.
 * It does not: serialising is not spacing. At one or two seconds per send, a hundred jobs that came due
 * while the worker was down leave the chip in three minutes — with concurrency 1 the whole way.
 *
 * What prevents the burst is the runtime interval guard in the use case, which reserves the channel's
 * next slot against the clock and returns DEFERRED when the interval has not elapsed. Concurrency is
 * now purely a throughput decision, kept at one for operational simplicity, and can be raised without
 * touching the pacing.
 */
@Processor(QUEUE_DISPATCH)
export class DispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(DispatchProcessor.name);

  constructor(
    private readonly runner: TenantScopedJobRunner,
    private readonly executeDispatch: ExecuteDispatchUseCase,
  ) {
    super();
  }

  async process(job: Job<DispatchJobData>, token?: string): Promise<void> {
    const { accountId, distributionId, dispatchId, timeZone } = job.data;

    const outcome = await this.runner.run(accountId, () =>
      this.executeDispatch.execute(
        new ExecuteDispatchCommand(accountId, distributionId, dispatchId, timeZone),
      ),
    );

    if (outcome.outcome === 'DEFERRED') {
      /**
       * Not a failure: the channel simply sent too recently. `moveToDelayed` + `DelayedError` is the
       * one path in BullMQ that pushes a job forward WITHOUT consuming an attempt and without marking
       * it failed — which is exactly the contract, since a deferral must not feed the circuit breaker
       * or the throttle's failure rate.
       *
       * The short jitter on top matters when a backlog drains: without it every job of the same channel
       * wakes at the same millisecond, all lose the race for the one slot, and all reschedule together
       * for the next instant — a tight loop of near-misses instead of a queue.
       */
      const jitterMs = Math.floor(Math.random() * DEFERRAL_JITTER_MS);
      await job.moveToDelayed(Date.now() + outcome.retryAfterMs + jitterMs, token);
      throw new DelayedError(outcome.detail ?? 'Intervalo mínimo do canal não decorrido');
    }

    if (outcome.outcome === 'RETRY') {
      // Transient: ask for the backoff. The message is what lands in the job's failedReason.
      throw new Error(outcome.detail ?? 'Falha temporária no envio');
    }

    if (outcome.outcome === 'FAILED') {
      // Permanent. Recorded on the dispatch already; UnrecoverableError documents in the queue itself
      // that no further attempt should be made, so an operator reading Redis sees the same verdict.
      this.logger.warn('Envio falhou permanentemente', { dispatchId, detail: outcome.detail });
      throw new UnrecoverableError(outcome.detail ?? 'Falha permanente no envio');
    }

    if (outcome.outcome === 'BLOCKED') {
      this.logger.warn('Envio bloqueado', { dispatchId, reason: outcome.blockedReason });
    }
  }
}
