import { Paciente } from '../../../domain/entities/paciente.entity';
import { PacienteId } from '../../../domain/value-objects/paciente-id.vo';

export const PACIENTE_REPOSITORY = Symbol('PACIENTE_REPOSITORY');

export interface PacienteRepositoryPort {
  save(paciente: Paciente): Promise<Paciente>;
  findById(id: PacienteId): Promise<Paciente | null>;
  findByHash(hash: string): Promise<Paciente | null>;
  findByPsicologo(psicologoId: string): Promise<Paciente[]>;
  delete(id: PacienteId): Promise<void>;
}
