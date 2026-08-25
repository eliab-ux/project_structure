import { DomainException } from '@gitspread/domain-primitives';

export class InvalidCredentialsException extends DomainException {
  constructor() {
    // Generic on purpose — never reveal whether the email exists.
    // English: the app's default locale is English (see frontend `src/i18n/`).
    super('Invalid credentials');
  }
}
