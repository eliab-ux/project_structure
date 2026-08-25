import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  SESSION_REPOSITORY,
  SessionRepositoryPort,
} from '../../ports/output/session-repository.port';
import { VIDEO_GATEWAY, VideoGatewayPort } from '../../ports/output/video-gateway.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  PACIENTE_REPOSITORY,
  PacienteRepositoryPort,
} from '../../../../paciente/application/ports/output/paciente-repository.port';
import { PacienteId } from '../../../../paciente/domain/value-objects/paciente-id.vo';
import { PacienteNotFoundException } from '../../../../paciente/domain/exceptions/paciente.exceptions';
import { Session } from '../../../domain/entities/session.entity';
import { SessionDto } from '../../dto/session.dto';

export class CreateSessionCommand {
  constructor(
    public readonly psicologoId: string,
    public readonly pacienteId: string,
  ) {}
}

@Injectable()
export class CreateSessionUseCase implements UseCase<CreateSessionCommand, SessionDto> {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    @Inject(PACIENTE_REPOSITORY) private readonly pacientes: PacienteRepositoryPort,
    @Inject(VIDEO_GATEWAY) private readonly video: VideoGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreateSessionCommand): Promise<SessionDto> {
    // Menor privilégio: o psicólogo só cria sessão para os próprios pacientes.
    const paciente = await this.pacientes.findById(PacienteId.from(command.pacienteId));
    if (!paciente || paciente.psicologoId !== command.psicologoId) {
      throw new PacienteNotFoundException(command.pacienteId);
    }

    // Reaproveita a sessão ativa deste paciente — assim "Iniciar sessão" e "Enviar link"
    // caem no MESMO código/sala (psicólogo e paciente se encontram).
    const active = await this.sessions.findActiveByParticipants(
      command.psicologoId,
      command.pacienteId,
    );
    if (active) {
      return SessionDto.fromDomain(active);
    }

    const room = await this.video.createRoom();
    const session = Session.create({
      psicologoId: command.psicologoId,
      pacienteId: command.pacienteId,
      dailyCoName: room.name,
    });

    const saved = await this.uow.execute(() => this.sessions.save(session));
    return SessionDto.fromDomain(saved);
    // O envio do link (WhatsApp/e-mail) é explícito — ver SendSessionLinkUseCase.
  }
}
