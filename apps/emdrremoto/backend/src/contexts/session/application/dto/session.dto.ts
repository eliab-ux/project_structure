import { Session } from '../../domain/entities/session.entity';

export class SessionDto {
  id!: string;
  sessionCode!: string;
  dailyCoName!: string | null;
  psicologoId!: string;
  pacienteId!: string;
  pacienteIn!: Date | null;
  psicologoIn!: Date | null;
  sessionOut!: Date | null;
  active!: boolean;
  createdAt!: Date;

  static fromDomain(session: Session): SessionDto {
    const dto = new SessionDto();
    dto.id = session.id.value;
    dto.sessionCode = session.sessionCode;
    dto.dailyCoName = session.dailyCoName;
    dto.psicologoId = session.psicologoId;
    dto.pacienteId = session.pacienteId;
    dto.pacienteIn = session.pacienteIn;
    dto.psicologoIn = session.psicologoIn;
    dto.sessionOut = session.sessionOut;
    dto.active = session.active;
    dto.createdAt = session.createdAt;
    return dto;
  }
}
