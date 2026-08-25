import { JwtPayload } from 'jsonwebtoken';

export type AuthRole = 'psicologo' | 'paciente';

/**
 * Minimal claims (Princípio do Menor Privilégio).
 * - psicologo: `sub` = psicologoId, `email` presente.
 * - paciente: `sub` = pacienteId, `sessionCode` amarra o token à sessão de convite.
 */
export interface AuthTokenPayload extends JwtPayload {
  sub: string;
  role: AuthRole;
  email?: string;
  nome?: string;
  sessionCode?: string;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface TokenServicePort {
  signAccessToken(payload: AuthTokenPayload): Promise<string>;
  signRefreshToken(payload: AuthTokenPayload): Promise<string>;
  verifyAccessToken(token: string): Promise<AuthTokenPayload>;
  verifyRefreshToken(token: string): Promise<AuthTokenPayload>;
}
