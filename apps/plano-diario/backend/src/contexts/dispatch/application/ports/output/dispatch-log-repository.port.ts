import { PaginatedResult } from '@gitspread/shared-kernel';
import { DispatchLog } from '../../../domain/entities/dispatch-log.entity';

export const DISPATCH_LOG_REPOSITORY = Symbol('DISPATCH_LOG_REPOSITORY');

export interface DispatchLogRepositoryPort {
  /**
   * Insere o log `pending`. Devolve `null` quando a UNIQUE parcial do banco recusa — ou seja,
   * quando já existe envio agendado para aquele dia. É assim que a idempotência é garantida:
   * pelo banco, não por consulta prévia (que dois workers concorrentes furariam).
   */
  createPending(log: DispatchLog): Promise<DispatchLog | null>;
  save(log: DispatchLog): Promise<DispatchLog>;
  findById(id: string): Promise<DispatchLog | null>;
  /**
   * O log agendado do dia, se existir. O tick usa isto para decidir entre não fazer nada
   * (já enviado), reaproveitar o log (falhou e ainda dá tempo) ou marcar `skipped`.
   */
  findScheduledFor(scheduleId: string, referenceDate: string): Promise<DispatchLog | null>;
  /** Para o rate limit do "Enviar agora". */
  countManualSince(userId: string, since: Date): Promise<number>;
  listByUser(
    userId: string,
    params: { page: number; limit: number },
  ): Promise<PaginatedResult<DispatchLog>>;
}
