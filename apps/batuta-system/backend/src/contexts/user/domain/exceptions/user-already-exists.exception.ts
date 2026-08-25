import { DomainException } from '@gitspread/domain-primitives';

export class UserAlreadyExistsException extends DomainException {
  constructor() {
    super('Já existe um usuário com este e-mail nesta conta.');
  }
}
