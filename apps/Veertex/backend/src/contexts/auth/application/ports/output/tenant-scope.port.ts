export const TENANT_SCOPE = Symbol('TENANT_SCOPE');

/**
 * Lets the authentication use cases establish the tenant scope once credentials have identified the
 * user — the one moment where the scope does not come from a JWT.
 *
 * A port rather than injecting `TenantContextService` directly, so the application layer keeps
 * pointing inward: the use case states *that* a scope must be established, and infrastructure owns
 * *how* (filter params plus the Postgres session variable the RLS policies read).
 */
export interface TenantScopePort {
  establishFromAuthenticatedUser(accountId: string): Promise<void>;
}
