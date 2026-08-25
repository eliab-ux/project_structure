import { DomainException } from '@gitspread/domain-primitives';

export class UserNotFoundException extends DomainException {
  constructor() {
    super('Usuário não encontrado');
  }
}
