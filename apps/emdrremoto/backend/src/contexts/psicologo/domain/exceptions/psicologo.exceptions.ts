import { DomainException } from '@gitspread/domain-primitives';

export class PsicologoNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Psicólogo não encontrado: ${identifier}`);
  }
}

export class PsicologoAlreadyExistsException extends DomainException {
  constructor(email: string) {
    super(`Já existe um psicólogo cadastrado com o e-mail ${email}.`);
  }
}
