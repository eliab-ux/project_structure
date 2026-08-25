import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { AuthTokenPayload, TokenServicePort } from './ports/token-service.port';

@Injectable()
export class JwtTokenService implements TokenServicePort {
  constructor(private readonly configService: ConfigService) {}

  async signAccessToken(payload: AuthTokenPayload): Promise<string> {
    const secret = this.ensureSecret(this.configService.get<string>('JWT_SECRET'), 'JWT_SECRET');
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '7d') as StringValue;
    const options: jwt.SignOptions = { expiresIn };
    return jwt.sign(payload, secret, options);
  }

  async signRefreshToken(payload: AuthTokenPayload): Promise<string> {
    const secret = this.ensureSecret(
      this.configService.get<string>('JWT_REFRESH_SECRET'),
      'JWT_REFRESH_SECRET',
    );
    const expiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '30d',
    ) as StringValue;
    const options: jwt.SignOptions = { expiresIn };
    return jwt.sign(payload, secret, options);
  }

  verifyRefreshToken(token: string): Promise<AuthTokenPayload> {
    const secret = this.ensureSecret(
      this.configService.get<string>('JWT_REFRESH_SECRET'),
      'JWT_REFRESH_SECRET',
    );

    return this.verifyToken(token, secret);
  }

  async verifyAccessToken(token: string): Promise<AuthTokenPayload> {
    const secret = this.ensureSecret(this.configService.get<string>('JWT_SECRET'), 'JWT_SECRET');
    return this.verifyToken(token, secret);
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
