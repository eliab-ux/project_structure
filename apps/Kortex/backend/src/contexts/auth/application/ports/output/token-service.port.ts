import { UserRole } from '../../../../user/domain/value-objects/user-role.vo';

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

/**
 * Claims do access token — o mínimo necessário (Menor Privilégio).
 *
 * `accountId` está aqui porque é a chave de isolamento multiconta: todo use case o recebe daqui e
 * **nunca** do corpo ou da query da requisição (spec §0.6). Nome, e-mail e telefone ficam de fora
 * — o token viaja em cada requisição e é legível por quem o tiver.
 */
export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  accountId: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenServicePort {
  issue(payload: AuthTokenPayload): IssuedTokens;
  /** Lança se inválido ou expirado — nunca devolve payload de token vencido. */
  verifyAccessToken(token: string): AuthTokenPayload;
  verifyRefreshToken(token: string): AuthTokenPayload;
}
