import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@gitspread/domain-primitives';
import { UseCase } from '@gitspread/shared-kernel';
import {
  SCHEDULE_REPOSITORY,
  ScheduleRepositoryPort,
} from '../../../../schedule/application/ports/output/schedule-repository.port';
import { ScheduleNotFoundException } from '../../../../schedule/domain/exceptions/schedule.exceptions';
import { localDateInTimeZone } from '../../../../../shared/plan/local-date';
import {
  DISPATCH_LOG_REPOSITORY,
  DispatchLogRepositoryPort,
} from '../../ports/output/dispatch-log-repository.port';
import { ExecuteDispatchUseCase } from '../execute-dispatch/execute-dispatch.use-case';

/** 3 envios manuais por hora (spec §8.2) — sem isso o grupo leva spam. */
export const MANUAL_SENDS_PER_HOUR = 3;

export class ManualSendRateLimitException extends DomainException {
  constructor() {
    super(
      `Limite de ${MANUAL_SENDS_PER_HOUR} envios manuais por hora atingido. Tente novamente mais tarde.`,
    );
  }
}

export interface SendNowResult {
  status: 'sent' | 'failed';
  message?: string;
  reason?: string;
}

/**
 * "Enviar agora": dispara a mensagem de hoje imediatamente.
 *
 * Usa `trigger = 'manual'`, que está FORA da unique parcial — então um teste manual nunca
 * consome o envio agendado do dia, nem é bloqueado por ele.
 */
@Injectable()
export class SendNowUseCase implements UseCase<{ userId: string }, SendNowResult> {
  constructor(
    @Inject(SCHEDULE_REPOSITORY) private readonly schedules: ScheduleRepositoryPort,
    @Inject(DISPATCH_LOG_REPOSITORY) private readonly logs: DispatchLogRepositoryPort,
    private readonly executeDispatch: ExecuteDispatchUseCase,
  ) {}

  async execute(command: { userId: string }): Promise<SendNowResult> {
    const schedule = await this.schedules.findByUserId(command.userId);
    if (!schedule) {
      throw new ScheduleNotFoundException();
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if ((await this.logs.countManualSince(command.userId, oneHourAgo)) >= MANUAL_SENDS_PER_HOUR) {
      throw new ManualSendRateLimitException();
    }

    const result = await this.executeDispatch.execute({
      scheduleId: schedule.id,
      referenceDate: localDateInTimeZone(new Date(), schedule.timezone.value),
      trigger: 'manual',
    });

    return {
      status: result.status === 'sent' ? 'sent' : 'failed',
      message: result.message,
      reason: result.reason,
    };
  }
}
