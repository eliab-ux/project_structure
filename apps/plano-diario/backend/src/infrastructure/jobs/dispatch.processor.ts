import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { Job, Queue } from 'bullmq';
import { PlanDispatchTickUseCase } from '../../contexts/dispatch/application/use-cases/plan-dispatch-tick/plan-dispatch-tick.use-case';
import { DispatchRunner } from './dispatch-runner';
import { recordPlan, recordTick, recordTickError, SchedulerStage } from './scheduler-state';
import {
  DISPATCH_QUEUE,
  dispatchSendJobId,
  DispatchSendPayload,
  JOB_DISPATCH_SEND,
  JOB_DISPATCH_TICK,
} from './jobs.constants';

/**
 * Fila de envio. O tick roda a cada minuto e enfileira o que está devido; o processor é fino de
 * propósito — quem decide o que enviar é o `PlanDispatchTickUseCase`, testável sem Redis.
 */
@Injectable()
@Processor(DISPATCH_QUEUE, { concurrency: 5 })
export class DispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(DispatchProcessor.name);

  constructor(
    private readonly planTick: PlanDispatchTickUseCase,
    private readonly runner: DispatchRunner,
    private readonly configService: ConfigService,
    private readonly orm: MikroORM,
    @InjectQueue(DISPATCH_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  /**
   * Todo job roda dentro de um `RequestContext` próprio.
   *
   * Sem isso o MikroORM recusa a operação — job não é request HTTP, então não existe o contexto
   * que o middleware cria, e usar o EntityManager global é proibido (a identity map seria
   * compartilhada entre jobs concorrentes). O envio diário falharia em todas as execuções.
   */
  async process(job: Job): Promise<unknown> {
    return RequestContext.create(this.orm.em, async () => {
      try {
        if (job.name === JOB_DISPATCH_TICK) {
          return await this.handleTick();
        }
        if (job.name === JOB_DISPATCH_SEND) {
          return await this.runner.run(job.data as DispatchSendPayload);
        }
        this.logger.warn('Job desconhecido na fila de dispatch', { name: job.name });
        return null;
      } catch (error) {
        // Sem este catch, uma exceção aqui virava só um job "failed" dentro do Redis: o envio
        // automático parava de funcionar e o log da aplicação não dizia uma palavra. Loga e
        // relança — o `throw` é o que faz o BullMQ contar a tentativa e reagendar com backoff.
        this.logger.error(`Job ${job.name} falhou`, {
          jobId: job.id,
          attempt: job.attemptsMade + 1,
          reason: (error as Error)?.message,
          stack: (error as Error)?.stack,
        });
        recordTickError(job.name === JOB_DISPATCH_SEND ? 'send' : this.stage);
        throw error;
      }
    });
  }

  /**
   * Etapa em que o tick está agora, para o `catch` saber onde quebrou.
   *
   * Um campo, e não um try/catch por etapa, porque o tratamento é idêntico nos dois casos — o que
   * muda é só o diagnóstico. E "onde quebrou" é o que separa "não consegui carregar/decidir" de
   * "decidi mas não consegui enfileirar", que têm causas completamente diferentes.
   */
  private stage: SchedulerStage = 'plan';

  private async handleTick(): Promise<{ enqueued: number }> {
    this.stage = 'plan';
    const due = await this.planTick.execute({
      catchUpWindowHours: Number(
        this.configService.get<string | number>('DISPATCH_CATCHUP_WINDOW_HOURS', 3),
      ),
    });
    recordPlan(due.length);
    this.stage = 'enqueue';

    const minuteKey = new Date().toISOString().slice(11, 16).replace(':', '');

    for (const item of due) {
      await this.queue.add(
        JOB_DISPATCH_SEND,
        {
          scheduleId: item.scheduleId,
          referenceDate: item.referenceDate,
          trigger: 'scheduled',
          existingLogId: item.existingLogId,
        } satisfies DispatchSendPayload,
        {
          jobId: dispatchSendJobId({
            scheduleId: item.scheduleId,
            referenceDate: item.referenceDate,
            minuteKey,
          }),
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    }

    // Registrado sempre, inclusive com `due` vazio: é o que faz o /api/health provar que o tick
    // está executando, sem precisar de log nem de acesso ao container.
    recordTick(due.length);

    if (due.length > 0) {
      this.logger.log('Envios enfileirados', {
        total: due.length,
        onTime: due.filter((d) => d.reason === 'on-time').length,
        catchUp: due.filter((d) => d.reason === 'catch-up').length,
      });
    }
    return { enqueued: due.length };
  }
}
