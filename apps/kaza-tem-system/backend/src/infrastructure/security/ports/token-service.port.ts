import { JwtPayload } from 'jsonwebtoken';

export type UserRoleValue = 'customer' | 'reseller' | 'admin';

export interface AuthTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  role: UserRoleValue;
  resellerId?: string;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface TokenServicePort {
  signAccessToken(payload: AuthTokenPayload): Promise<string>;
  signRefreshToken(payload: AuthTokenPayload): Promise<string>;
  verifyRefreshToken(token: string): Promise<AuthTokenPayload>;
  verifyAccessToken(token: string): Promise<AuthTokenPayload>;
}
