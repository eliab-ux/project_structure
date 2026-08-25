import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  SESSION_REPOSITORY,
  SessionRepositoryPort,
} from '../../ports/output/session-repository.port';
import {
  PACIENTE_REPOSITORY,
  PacienteRepositoryPort,
} from '../../../../paciente/application/ports/output/paciente-repository.port';
import { PacienteId } from '../../../../paciente/domain/value-objects/paciente-id.vo';
import {
  SessionNotFoundException,
  SessionUnauthorizedException,
} from '../../../domain/exceptions/session.exceptions';

export class GetSessionInviteQuery {
  constructor(
    public readonly psicologoId: string,
    public readonly sessionCode: string,
  ) {}
}

export interface SessionInviteResult {
  sessionCode: string;
  hash: string;
}

/**
 * Devolve o hash de convite do paciente da sessão — só para o psicólogo dono da sessão.
 * O frontend monta o link `/sessao/<hash>?code=<sessionCode>`.
 */
@Injectable()
export class GetSessionInviteUseCase implements UseCase<
  GetSessionInviteQuery,
  SessionInviteResult
> {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    @Inject(PACIENTE_REPOSITORY) private readonly pacientes: PacienteRepositoryPort,
  ) {}

  async execute(query: GetSessionInviteQuery): Promise<SessionInviteResult> {
    const session = await this.sessions.findByCode(query.sessionCode);
    if (!session) {
      throw new SessionNotFoundException(query.sessionCode);
    }
    if (!session.isMember(query.psicologoId, 'psicologo')) {
      throw new SessionUnauthorizedException();
    }
    const paciente = await this.pacientes.findById(PacienteId.from(session.pacienteId));
    if (!paciente) {
      throw new SessionNotFoundException(query.sessionCode);
    }
    return { sessionCode: session.sessionCode, hash: paciente.hash };
  }
}
