import { JwtPayload } from 'jsonwebtoken';

export type UserRoleValue = 'user' | 'admin';

/**
 * Minimal claims (Princípio do Menor Privilégio). `sub` is the tenant id (owner_id).
 * There is intentionally no Instagram data here — "who you are in Ecoa" is independent
 * of "which Instagram you monitor".
 */
export interface AuthTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  role: UserRoleValue;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface TokenServicePort {
  signAccessToken(payload: AuthTokenPayload): Promise<string>;
  signRefreshToken(payload: AuthTokenPayload): Promise<string>;
  verifyAccessToken(token: string): Promise<AuthTokenPayload>;
  verifyRefreshToken(token: string): Promise<AuthTokenPayload>;
}
