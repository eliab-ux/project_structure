import { DomainException } from '@gitspread/domain-primitives';

/**
 * One opaque failure for every way a token can be unacceptable — absent, malformed, expired, wrong
 * signature, wrong kind. Telling them apart would tell an attacker which part of a forged token to
 * fix next.
 *
 * The name contains "Unauthorized", which is what GlobalExceptionFilter maps to HTTP 401.
 */
export class UnauthorizedTokenException extends DomainException {
  constructor() {
    super('Sessão inválida ou expirada. Entre novamente.');
  }
}
