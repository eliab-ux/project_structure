import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { TokenCryptoPort } from './ports/token-crypto.port';

/**
 * AES-256-GCM encryption for Instagram access tokens at rest.
 * Key comes exclusively from IG_TOKEN_ENCRYPTION_KEY (.env) — 32 bytes, hex-encoded (64 chars).
 * Output format: base64(iv):base64(authTag):base64(ciphertext).
 */
@Injectable()
export class AesTokenCrypto implements TokenCryptoPort {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12;

  constructor(private readonly configService: ConfigService) {}

  encrypt(plaintext: string): string {
    const key = this.key();
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(ciphertext: string): string {
    const key = this.key();
    const [ivB64, tagB64, dataB64] = ciphertext.split(':');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Malformed encrypted token');
    }
    const decipher = createDecipheriv(this.algorithm, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private key(): Buffer {
    const hex = this.configService.get<string>('IG_TOKEN_ENCRYPTION_KEY');
    if (!hex) {
      throw new Error('IG_TOKEN_ENCRYPTION_KEY is required to encrypt/decrypt Instagram tokens');
    }
    const key = Buffer.from(hex, 'hex');
    if (key.length !== 32) {
      throw new Error('IG_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
    }
    return key;
  }
}
