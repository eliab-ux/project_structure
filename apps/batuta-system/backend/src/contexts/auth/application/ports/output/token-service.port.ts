export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

/**
 * Claims of a tenant access token. Minimal on purpose (Least Privilege): everything else is read
 * from the database. `accountId` here is the ONLY source of tenant scope in the whole system —
 * no request body, query or header may ever supply it.
 */
export interface AuthTokenPayload {
  sub: string;
  accountId: string;
  role: 'ACCOUNT_ADMIN' | 'OPERATOR';
}

/** Claims of a platform token. Separate shape: it has no `accountId` at all. */
export interface PlatformTokenPayload {
  sub: string;
  scope: 'PLATFORM';
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires — the frontend schedules the refresh with it. */
  expiresIn: number;
}

export interface TokenServicePort {
  issueForUser(payload: AuthTokenPayload): IssuedTokens;
  issueForPlatformAdmin(payload: PlatformTokenPayload): IssuedTokens;
  /** Throws InvalidTokenException when absent, malformed, expired or of the wrong kind. */
  verifyAccessToken(token: string): AuthTokenPayload;
  verifyPlatformAccessToken(token: string): PlatformTokenPayload;
  verifyRefreshToken(token: string): AuthTokenPayload;
  verifyPlatformRefreshToken(token: string): PlatformTokenPayload;
}
