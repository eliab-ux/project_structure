import { DomainException } from '@gitspread/domain-primitives';

export class InvalidCredentialsException extends DomainException {
  constructor() {
    super('Credenciais inválidas.');
  }
}
