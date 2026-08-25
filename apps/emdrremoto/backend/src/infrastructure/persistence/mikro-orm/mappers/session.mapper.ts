import { Injectable } from '@nestjs/common';
import { Session } from '../../../../contexts/session/domain/entities/session.entity';
import { SessionId } from '../../../../contexts/session/domain/value-objects/session-id.vo';
import { SessionOrmEntity } from '../entities/session-orm.entity';

@Injectable()
export class SessionMapper {
  toDomain(orm: SessionOrmEntity): Session {
    return Session.reconstitute(
      SessionId.from(orm.id),
      orm.sessionCode,
      orm.dailyCoName ?? null,
      orm.psicologoId,
      orm.pacienteId,
      orm.pacienteIn ?? null,
      orm.psicologoIn ?? null,
      orm.sessionOut ?? null,
      orm.active,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  toOrm(domain: Session, existing?: SessionOrmEntity): SessionOrmEntity {
    const orm = existing ?? new SessionOrmEntity();
    orm.id = domain.id.value;
    orm.sessionCode = domain.sessionCode;
    orm.dailyCoName = domain.dailyCoName;
    orm.psicologoId = domain.psicologoId;
    orm.pacienteId = domain.pacienteId;
    orm.pacienteIn = domain.pacienteIn;
    orm.psicologoIn = domain.psicologoIn;
    orm.sessionOut = domain.sessionOut;
    orm.active = domain.active;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
