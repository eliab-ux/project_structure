import { Injectable } from '@nestjs/common';
import { Psicologo } from '../../../../contexts/psicologo/domain/entities/psicologo.entity';
import { PsicologoId } from '../../../../contexts/psicologo/domain/value-objects/psicologo-id.vo';
import { Email } from '../../../../contexts/psicologo/domain/value-objects/email.vo';
import { PsicologoOrmEntity } from '../entities/psicologo-orm.entity';

@Injectable()
export class PsicologoMapper {
  toDomain(orm: PsicologoOrmEntity): Psicologo {
    return Psicologo.reconstitute(
      PsicologoId.from(orm.id),
      Email.create(orm.email),
      orm.nome,
      orm.telefone,
      orm.passwordHash,
      orm.emailVerificado,
      orm.recoveryCode ?? null,
      orm.active,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  toOrm(domain: Psicologo, existing?: PsicologoOrmEntity): PsicologoOrmEntity {
    const orm = existing ?? new PsicologoOrmEntity();
    orm.id = domain.id.value;
    orm.email = domain.email.value;
    orm.nome = domain.nome;
    orm.telefone = domain.telefone;
    orm.passwordHash = domain.passwordHash;
    orm.emailVerificado = domain.emailVerificado;
    orm.recoveryCode = domain.recoveryCode;
    orm.active = domain.active;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
