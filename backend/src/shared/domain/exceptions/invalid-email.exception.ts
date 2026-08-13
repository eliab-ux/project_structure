import { DomainException } from '@veertex/domain-primitives';

export class InvalidEmailException extends DomainException {
  constructor() {
    super('E-mail inválido.');
  }
}
