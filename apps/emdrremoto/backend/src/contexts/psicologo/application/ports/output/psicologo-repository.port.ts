import { Psicologo } from '../../../domain/entities/psicologo.entity';
import { PsicologoId } from '../../../domain/value-objects/psicologo-id.vo';
import { Email } from '../../../domain/value-objects/email.vo';

export const PSICOLOGO_REPOSITORY = Symbol('PSICOLOGO_REPOSITORY');

export interface PsicologoRepositoryPort {
  save(psicologo: Psicologo): Promise<Psicologo>;
  findById(id: PsicologoId): Promise<Psicologo | null>;
  findByEmail(email: Email): Promise<Psicologo | null>;
  findByRecoveryCode(code: string): Promise<Psicologo | null>;
}
