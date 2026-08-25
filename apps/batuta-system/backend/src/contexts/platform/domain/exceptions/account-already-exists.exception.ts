import { DomainException } from '@gitspread/domain-primitives';

export class AccountAlreadyExistsException extends DomainException {
  constructor() {
    super('Já existe uma conta com este documento.');
  }
}
