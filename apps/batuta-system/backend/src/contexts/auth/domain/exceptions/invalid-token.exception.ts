import { DomainException } from '@gitspread/domain-primitives';

/**
 * Name matters: the GlobalExceptionFilter maps an exception whose name matches `Unauthorized`
 * or `InvalidCredentials` to HTTP 401.
 */
export class UnauthorizedTokenException extends DomainException {
  constructor() {
    // Never says WHY (expired vs malformed vs wrong kind) — that is free information to an attacker.
    super('Sessão inválida ou expirada. Autentique-se novamente.');
  }
}
