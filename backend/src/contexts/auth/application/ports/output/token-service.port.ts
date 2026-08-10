export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

/**
 * Claims of an access token. Minimal on purpose (Least Privilege) — everything else is read from
 * the database.
 *
 * `accountId` here is the ONLY source of tenant scope in the whole system. No request body, query
 * or header may ever supply it, which is why no request DTO in this codebase has such a field.
 *
 * `permissions` travels in the token rather than being loaded per request, and that is a deliberate
 * trade with a cost worth naming: a demoted user keeps the old permissions until their access token
 * expires (15 min) or they refresh. The alternative — reading the role on every request — would
 * need its own transaction inside the guard, because guards run *before* the request transaction
 * that carries the RLS scope, and a query outside that scope returns nothing. Same trade the rest
 * of the house already makes for roles.
 */
export interface AuthTokenPayload {
  /** User id. */
  sub: string;
  accountId: string;
  roleId: string;
  /** Effective permission strings, including wildcards (`*`, `companies.*`). */
  permissions: string[];
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires — the frontend schedules the refresh with it. */
  expiresIn: number;
}

export interface TokenServicePort {
  issueForUser(payload: AuthTokenPayload): IssuedTokens;
  /** Throws UnauthorizedTokenException when absent, malformed, expired or of the wrong kind. */
  verifyAccessToken(token: string): AuthTokenPayload;
  verifyRefreshToken(token: string): AuthTokenPayload;
}
