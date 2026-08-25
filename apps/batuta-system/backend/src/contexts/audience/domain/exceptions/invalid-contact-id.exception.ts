import { DomainException } from '@gitspread/domain-primitives';

export class InvalidContactIdException extends DomainException {
  constructor() {
    super('Identificador de contato inválido.');
  }
}
