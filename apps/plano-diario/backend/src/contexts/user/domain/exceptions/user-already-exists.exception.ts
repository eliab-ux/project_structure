import { DomainException } from '@gitspread/domain-primitives';

export class UserAlreadyExistsException extends DomainException {
  constructor() {
    super('Já existe uma conta com este e-mail');
  }
}
