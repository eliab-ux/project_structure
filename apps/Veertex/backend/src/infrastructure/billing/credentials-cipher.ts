import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredentialsCipherPort } from '../../contexts/billing/application/ports/output/billing-support.ports';

/**
 * aes-256-gcm com chave em `BILLING_CREDENTIALS_KEY` (64 hex = 32 bytes). Formato do ciphertext:
 * `iv:tag:payload` (hex). Sem a chave configurada, cifrar/decifrar RECUSA LOUD — guardar credencial
 * em claro "só por enquanto" é como credencial vaza; a config de cobrança simplesmente não salva
 * até a chave existir.
 */
@Injectable()
export class AesCredentialsCipher implements CredentialsCipherPort {
  constructor(private readonly config: ConfigService) {}

  private key(): Buffer {
    const hex = this.config.get<string>('BILLING_CREDENTIALS_KEY') ?? '';
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error(
        'BILLING_CREDENTIALS_KEY ausente ou inválida (precisa de 64 caracteres hex). ' +
          'Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    return Buffer.from(hex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, tagHex, payloadHex] = ciphertext.split(':');
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(payloadHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }
}
