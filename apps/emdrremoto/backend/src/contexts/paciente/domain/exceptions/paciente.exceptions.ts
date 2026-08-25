import { DomainException } from '@gitspread/domain-primitives';

export class PacienteNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Paciente não encontrado: ${identifier}`);
  }
}
