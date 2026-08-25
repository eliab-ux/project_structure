import { JwtPayload } from 'jsonwebtoken';

export type UserRoleValue = 'user' | 'admin';

/**
 * Claims mínimos (Princípio do Menor Privilégio). `sub` é o id do usuário e a chave de
 * tenancy — nenhum dado de WhatsApp, grupo ou agendamento entra no token.
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
