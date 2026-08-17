import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import {
  AuthTokenPayload,
  IssuedTokens,
  TokenServicePort,
} from '../../contexts/auth/application/ports/output/token-service.port';
import { isUserRole } from '../../contexts/user/domain/value-objects/user-role.vo';

@Injectable()
export class JwtTokenService implements TokenServicePort, OnModuleInit {
  private accessSecret!: string;
  private refreshSecret!: string;
  private accessExpiration!: string;
  private refreshExpiration!: string;

  constructor(private readonly config: ConfigService) {}

  /**
   * Os segredos são lidos e conferidos no boot, não a cada emissão.
   *
   * Falhar aqui é falhar cedo e alto: um backend que sobe sem `JWT_ACCESS_SECRET` só descobre o
   * problema no primeiro login, em produção, com o usuário na frente. E os dois segredos precisam
   * ser diferentes — iguais, um refresh token passa como access token e a expiração curta do
   * access vira decoração.
   */
  onModuleInit(): void {
    this.accessSecret = this.requireSecret('JWT_ACCESS_SECRET');
    this.refreshSecret = this.requireSecret('JWT_REFRESH_SECRET');

    if (this.accessSecret === this.refreshSecret) {
      throw new Error('JWT_ACCESS_SECRET e JWT_REFRESH_SECRET devem ser diferentes.');
    }

    this.accessExpiration = this.config.get<string>('JWT_ACCESS_EXPIRATION') ?? '15m';
    this.refreshExpiration = this.config.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d';
  }

  private requireSecret(key: string): string {
    const value = this.config.get<string>(key);
    if (!value || value.length < 32) {
      // A mensagem nomeia a variável, jamais o valor.
      throw new Error(`${key} não configurado ou curto demais (mínimo 32 caracteres).`);
    }
    return value;
  }

  issue(payload: AuthTokenPayload): IssuedTokens {
    return {
      accessToken: jwt.sign(payload, this.accessSecret, {
        expiresIn: this.accessExpiration,
      } as jwt.SignOptions),
      refreshToken: jwt.sign(payload, this.refreshSecret, {
        expiresIn: this.refreshExpiration,
      } as jwt.SignOptions),
    };
  }

  verifyAccessToken(token: string): AuthTokenPayload {
    return this.verify(token, this.accessSecret);
  }

  verifyRefreshToken(token: string): AuthTokenPayload {
    return this.verify(token, this.refreshSecret);
  }

  /**
   * O formato do payload é conferido campo a campo depois da verificação da assinatura.
   *
   * Não é paranoia: `jwt.verify` devolve `string | JwtPayload`, e o resto do sistema trata
   * `accountId` como a chave de isolamento entre contas. Aceitá-lo como `any` seria confiar num
   * dado externo justamente no ponto onde ele decide quais registros o usuário enxerga.
   */
  private verify(token: string, secret: string): AuthTokenPayload {
    const decoded = jwt.verify(token, secret);

    if (typeof decoded !== 'object' || decoded === null) {
      throw new jwt.JsonWebTokenError('Payload inválido.');
    }

    const { sub, role, accountId } = decoded as Record<string, unknown>;

    if (typeof sub !== 'string' || typeof accountId !== 'string' || !isUserRole(role)) {
      throw new jwt.JsonWebTokenError('Payload inválido.');
    }

    return { sub, role, accountId };
  }
}
