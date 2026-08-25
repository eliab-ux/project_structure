import { DomainException } from '@gitspread/domain-primitives';

export class InvalidUserIdException extends DomainException {
  constructor() {
    super('Identificador de usuário inválido');
  }
}
