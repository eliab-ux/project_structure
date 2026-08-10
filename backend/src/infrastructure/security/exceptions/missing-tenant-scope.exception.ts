/**
 * Raised when code that needs a tenant runs without one. Deliberately NOT a DomainException: it is
 * never a business outcome to explain to a user, it is a wiring bug — a route without the guard, a
 * job started without a scope. It surfaces as a 500 and reaches the error reporter, which is
 * exactly the visibility a silent cross-tenant read would not have.
 */
export class MissingTenantScopeException extends Error {
  constructor() {
    super('Escopo de conta ausente: a operação exige um tenant estabelecido.');
    this.name = 'MissingTenantScopeException';
  }
}
