import { DomainException } from '@gitspread/domain-primitives';

export class InvalidAccountIdException extends DomainException {
  constructor() {
    super('Identificador de conta inválido.');
  }
}
