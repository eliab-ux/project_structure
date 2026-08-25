import { DomainException } from '@gitspread/domain-primitives';

export class InvalidCredentialsException extends DomainException {
  constructor() {
    super('Invalid email or password');
  }
}
