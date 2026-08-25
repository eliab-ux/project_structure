import { Session } from '../../../domain/entities/session.entity';
import { SessionId } from '../../../domain/value-objects/session-id.vo';

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

export interface SessionRepositoryPort {
  save(session: Session): Promise<Session>;
  findById(id: SessionId): Promise<Session | null>;
  findByCode(sessionCode: string): Promise<Session | null>;
  /** Sessão ativa mais recente entre este psicólogo e paciente (reaproveitar a mesma sala). */
  findActiveByParticipants(psicologoId: string, pacienteId: string): Promise<Session | null>;
  /** Sessões ativas com sala criada antes de `before` — usado pelo cron de limpeza. */
  findStaleActive(before: Date): Promise<Session[]>;
}
