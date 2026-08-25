import { DomainException } from '@gitspread/domain-primitives';

/**
 * Raised when code touches tenant data without a tenant scope in force. It maps to a 500, and
 * that is correct: it is a programming error, not a client error — and failing is the whole point
 * (a query without scope must never be widened into a cross-tenant read).
 */
export class MissingTenantScopeException extends DomainException {
  constructor() {
    super('Escopo de tenant não estabelecido para este request.');
  }
}
