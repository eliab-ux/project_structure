import { Injectable } from '@nestjs/common';
import { Paciente } from '../../../../contexts/paciente/domain/entities/paciente.entity';
import { PacienteId } from '../../../../contexts/paciente/domain/value-objects/paciente-id.vo';
import { PacienteOrmEntity } from '../entities/paciente-orm.entity';

@Injectable()
export class PacienteMapper {
  toDomain(orm: PacienteOrmEntity): Paciente {
    return Paciente.reconstitute(
      PacienteId.from(orm.id),
      orm.psicologoId,
      orm.email,
      orm.nome,
      orm.telefone,
      orm.pais ?? null,
      orm.hash,
      orm.active,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  toOrm(domain: Paciente, existing?: PacienteOrmEntity): PacienteOrmEntity {
    const orm = existing ?? new PacienteOrmEntity();
    orm.id = domain.id.value;
    orm.psicologoId = domain.psicologoId;
    orm.email = domain.email;
    orm.nome = domain.nome;
    orm.telefone = domain.telefone;
    orm.pais = domain.pais;
    orm.hash = domain.hash;
    orm.active = domain.active;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
