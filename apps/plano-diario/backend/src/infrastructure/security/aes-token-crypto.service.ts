import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { TokenCryptoPort } from './ports/token-crypto.port';

/**
 * AES-256-GCM para o token da instância do WhatsApp em repouso.
 * A chave vem exclusivamente de ENCRYPTION_KEY (.env) — 32 bytes em hex (64 chars).
 * Formato de saída: base64(iv):base64(authTag):base64(ciphertext).
 *
 * GCM e não CBC porque o authTag detecta adulteração: um token modificado no banco falha ao
 * decifrar em vez de virar lixo silencioso que só quebraria na hora do envio.
 */
@Injectable()
export class AesTokenCrypto implements TokenCryptoPort {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12;

  constructor(private readonly configService: ConfigService) {}

  encrypt(plaintext: string): string {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivB64, tagB64, dataB64] = (ciphertext ?? '').split(':');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Malformed encrypted token');
    }
    const decipher = createDecipheriv(this.algorithm, this.key(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private key(): Buffer {
    const hex = this.configService.get<string>('ENCRYPTION_KEY');
    if (!hex) {
      throw new Error('ENCRYPTION_KEY é obrigatória para criptografar o token da instância');
    }
    const key = Buffer.from(hex, 'hex');
    if (key.length !== 32) {
      throw new Error('ENCRYPTION_KEY deve ter 32 bytes (64 caracteres hex)');
    }
    return key;
  }
}
