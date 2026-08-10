import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import {
  AuthTokenPayload,
  IssuedTokens,
  TokenServicePort,
} from '../../contexts/auth/application/ports/output/token-service.port';
import { UnauthorizedTokenException } from '../../contexts/auth/domain/exceptions/invalid-token.exception';

/**
 * Token kinds are explicit in the payload (`typ`) and verified on the way in. Without it, a refresh
 * token would be accepted as an access token — that is a privilege escalation, not an edge case,
 * because refresh tokens are long-lived and the client stores them.
 */
type TokenKind = 'access' | 'refresh';

interface SignedClaims {
  typ: TokenKind;
}

const ISSUER = 'veertex';

@Injectable()
export class JwtTokenService implements TokenServicePort, OnModuleInit {
  private readonly logger = new Logger(JwtTokenService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    // Fail loudly at boot in production rather than at the first login attempt.
    if (this.config.get<string>('NODE_ENV') === 'production') {
      this.accessSecret();
      this.refreshSecret();
    }
  }

  issueForUser(payload: AuthTokenPayload): IssuedTokens {
    const accessExpiration = this.config.get<string>('JWT_ACCESS_EXPIRATION') ?? '15m';
    const refreshExpiration = this.config.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d';

    const accessToken = this.sign(
      { ...payload, typ: 'access' },
      this.accessSecret(),
      accessExpiration,
    );
    const refreshToken = this.sign(
      { ...payload, typ: 'refresh' },
      this.refreshSecret(),
      refreshExpiration,
    );

    return { accessToken, refreshToken, expiresIn: this.decodeExpiresIn(accessToken) };
  }

  verifyAccessToken(token: string): AuthTokenPayload {
    return this.verifyUser(token, this.accessSecret(), 'access');
  }

  verifyRefreshToken(token: string): AuthTokenPayload {
    return this.verifyUser(token, this.refreshSecret(), 'refresh');
  }

  private verifyUser(token: string, secret: string, expected: TokenKind): AuthTokenPayload {
    const claims = this.verify(token, secret, expected);
    const { sub, accountId, roleId, permissions } = claims as unknown as AuthTokenPayload;

    // A token without accountId is unusable: it would produce an unscoped request, and an unscoped
    // request under RLS silently reads nothing — a confusing failure instead of a clear refusal.
    if (!sub || !accountId || !roleId || !Array.isArray(permissions)) {
      throw new UnauthorizedTokenException();
    }

    return {
      sub,
      accountId,
      roleId,
      // Defensive copy of a value that came off the wire: nothing downstream should be able to
      // mutate the guard's view of what this request may do.
      permissions: permissions.filter((item): item is string => typeof item === 'string'),
    };
  }

  private verify(
    token: string,
    secret: string,
    expected: TokenKind,
  ): jwt.JwtPayload & SignedClaims {
    try {
      const claims = jwt.verify(token, secret, {
        issuer: ISSUER,
        algorithms: ['HS256'],
      }) as jwt.JwtPayload & SignedClaims;

      if (claims.typ !== expected) {
        // Right signature, wrong kind of token — refuse without saying which.
        throw new UnauthorizedTokenException();
      }
      return claims;
    } catch (error) {
      if (error instanceof UnauthorizedTokenException) {
        throw error;
      }
      // Expired / malformed / bad signature all collapse into one opaque failure.
      this.logger.debug('Token rejeitado', { reason: (error as Error)?.name });
      throw new UnauthorizedTokenException();
    }
  }

  private sign(claims: object, secret: string, expiresIn: string): string {
    return jwt.sign(claims, secret, {
      algorithm: 'HS256',
      issuer: ISSUER,
      expiresIn,
    } as jwt.SignOptions);
  }

  private decodeExpiresIn(token: string): number {
    const decoded = jwt.decode(token) as jwt.JwtPayload | null;
    if (!decoded?.exp) {
      return 0;
    }
    return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
  }

  private accessSecret(): string {
    return this.requireSecret('JWT_ACCESS_SECRET');
  }

  private refreshSecret(): string {
    return this.requireSecret('JWT_REFRESH_SECRET');
  }

  private requireSecret(key: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string {
    const secret = this.config.get<string>(key);
    if (!secret) {
      // Never fall back to a default secret: that is a signing key everyone knows.
      throw new Error(`${key} não configurado. Defina no .env (ver .env.example).`);
    }
    return secret;
  }
}
