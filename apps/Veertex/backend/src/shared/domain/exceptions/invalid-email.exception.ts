import { DomainException } from '@gitspread/domain-primitives';

export class InvalidEmailException extends DomainException {
  constructor() {
    super('E-mail inválido.');
  }
}
