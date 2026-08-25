import { DomainException } from '@gitspread/domain-primitives';

export class UserNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Usuário não encontrado: ${identifier}`);
  }
}
