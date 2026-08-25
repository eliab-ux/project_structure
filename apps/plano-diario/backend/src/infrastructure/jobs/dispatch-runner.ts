import { Injectable } from '@nestjs/common';
import { ExecuteDispatchUseCase } from '../../contexts/dispatch/application/use-cases/execute-dispatch/execute-dispatch.use-case';
import { DispatchSendPayload } from './jobs.constants';

/**
 * Executa um envio enfileirado. Separado do processor porque o retry do BullMQ precisa de um
 * ponto onde a falha vira exceção — o log no banco já foi marcado `failed` pelo use case, e
 * lançar aqui é o que faz o BullMQ reagendar com backoff.
 */
@Injectable()
export class DispatchRunner {
  constructor(private readonly executeDispatch: ExecuteDispatchUseCase) {}

  async run(payload: DispatchSendPayload): Promise<{ status: string }> {
    const result = await this.executeDispatch.execute({
      scheduleId: payload.scheduleId,
      referenceDate: payload.referenceDate,
      trigger: payload.trigger,
      existingLogId: payload.existingLogId,
    });

    if (result.status === 'failed') {
      throw new Error(result.reason ?? 'Falha no envio');
    }
    return { status: result.status };
  }
}
