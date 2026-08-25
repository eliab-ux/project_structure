import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { AuthTokenPayload, TokenServicePort } from './ports/token-service.port';

@Injectable()
export class JwtTokenService implements TokenServicePort {
  constructor(private readonly configService: ConfigService) {}

  async signAccessToken(payload: AuthTokenPayload): Promise<string> {
    const secret = this.ensureSecret(
      this.configService.get<string>('JWT_ACCESS_SECRET'),
      'JWT_ACCESS_SECRET',
    );
    const expiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m') as StringValue;
    return jwt.sign(this.claims(payload), secret, { expiresIn });
  }

  async signRefreshToken(payload: AuthTokenPayload): Promise<string> {
    const secret = this.ensureSecret(
      this.configService.get<string>('JWT_REFRESH_SECRET'),
      'JWT_REFRESH_SECRET',
    );
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d') as StringValue;
    return jwt.sign(this.claims(payload), secret, { expiresIn });
  }

  async verifyAccessToken(token: string): Promise<AuthTokenPayload> {
    const secret = this.ensureSecret(
      this.configService.get<string>('JWT_ACCESS_SECRET'),
      'JWT_ACCESS_SECRET',
    );
    return this.verifyToken(token, secret);
  }

  async verifyRefreshToken(token: string): Promise<AuthTokenPayload> {
    const secret = this.ensureSecret(
      this.configService.get<string>('JWT_REFRESH_SECRET'),
      'JWT_REFRESH_SECRET',
    );
    return this.verifyToken(token, secret);
  }

  /** Only the minimal claims are signed — never leak extra data into the token. */
  private claims(payload: AuthTokenPayload): AuthTokenPayload {
    return { sub: payload.sub, email: payload.email, role: payload.role };
  }

  private verifyToken(token: string, secret: string): Promise<AuthTokenPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, secret, (err: jwt.VerifyErrors | null, decoded: unknown) => {
        if (err || typeof decoded === 'string') {
          return reject(err ?? new Error('Invalid token'));
        }
        const typed = decoded as AuthTokenPayload;
        if (!typed.sub || !typed.email || !typed.role) {
          return reject(new Error('Invalid token payload'));
        }
        resolve(typed);
      });
    });
  }

  private ensureSecret(value: string | undefined, name: string): string {
    if (!value) {
      throw new Error(`${name} is required`);
    }
    return value;
  }
}
