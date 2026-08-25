import { DomainException } from '@gitspread/domain-primitives';

export class UserDisabledException extends DomainException {
  constructor() {
    super('Usuário desativado.');
  }
}
