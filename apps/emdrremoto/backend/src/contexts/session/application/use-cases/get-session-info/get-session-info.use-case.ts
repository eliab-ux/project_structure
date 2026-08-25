import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  SESSION_REPOSITORY,
  SessionRepositoryPort,
} from '../../ports/output/session-repository.port';
import {
  PSICOLOGO_REPOSITORY,
  PsicologoRepositoryPort,
} from '../../../../psicologo/application/ports/output/psicologo-repository.port';
import { PsicologoId } from '../../../../psicologo/domain/value-objects/psicologo-id.vo';
import {
  PACIENTE_REPOSITORY,
  PacienteRepositoryPort,
} from '../../../../paciente/application/ports/output/paciente-repository.port';
import { PacienteId } from '../../../../paciente/domain/value-objects/paciente-id.vo';
import { SessionRole } from '../../../domain/entities/session.entity';
import {
  SessionNotFoundException,
  SessionUnauthorizedException,
} from '../../../domain/exceptions/session.exceptions';

export class GetSessionInfoQuery {
  constructor(
    public readonly userId: string,
    public readonly role: SessionRole,
    public readonly sessionCode: string,
  ) {}
}

export interface SessionInfoResult {
  sessionCode: string;
  dailyCoName: string | null;
  psicologoId: string;
  pacienteId: string;
  psicologoNome: string;
  pacienteNome: string;
  active: boolean;
}

/**
 * Dados da sessão para a sala, incluindo os NOMES dos participantes (para as telas de espera
 * e presença). Só um membro da sessão pode consultar (menor privilégio).
 */
@Injectable()
export class GetSessionInfoUseCase implements UseCase<GetSessionInfoQuery, SessionInfoResult> {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    @Inject(PSICOLOGO_REPOSITORY) private readonly psicologos: PsicologoRepositoryPort,
    @Inject(PACIENTE_REPOSITORY) private readonly pacientes: PacienteRepositoryPort,
  ) {}

  async execute(query: GetSessionInfoQuery): Promise<SessionInfoResult> {
    const session = await this.sessions.findByCode(query.sessionCode);
    if (!session) {
      throw new SessionNotFoundException(query.sessionCode);
    }
    if (!session.isMember(query.userId, query.role)) {
      throw new SessionUnauthorizedException();
    }

    const psicologo = await this.psicologos.findById(PsicologoId.from(session.psicologoId));
    const paciente = await this.pacientes.findById(PacienteId.from(session.pacienteId));

    return {
      sessionCode: session.sessionCode,
      dailyCoName: session.dailyCoName,
      psicologoId: session.psicologoId,
      pacienteId: session.pacienteId,
      psicologoNome: psicologo?.nome ?? 'o psicólogo',
      pacienteNome: paciente?.nome ?? 'o paciente',
      active: session.active,
    };
  }
}
