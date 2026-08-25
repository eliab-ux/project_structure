import { ConfigService } from '@nestjs/config';
import { AesTokenCrypto } from '../../../src/infrastructure/security/aes-token-crypto.service';

// 32-byte key (64 hex chars) used only for this test.
const TEST_KEY = 'a'.repeat(64);

function makeCrypto(key: string | undefined = TEST_KEY): AesTokenCrypto {
  const config = { get: (name: string) => (name === 'IG_TOKEN_ENCRYPTION_KEY' ? key : undefined) };
  return new AesTokenCrypto(config as unknown as ConfigService);
}

describe('AesTokenCrypto (Instagram token at rest)', () => {
  it('round-trips ciphertext back to the original plaintext', () => {
    const crypto = makeCrypto();
    const secret = 'EAAB-super-long-instagram-token-value';
    const encrypted = crypto.encrypt(secret);
    expect(encrypted).not.toContain(secret); // never stored in the clear
    expect(crypto.decrypt(encrypted)).toBe(secret);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const crypto = makeCrypto();
    expect(crypto.encrypt('same')).not.toBe(crypto.encrypt('same'));
  });

  it('fails to decrypt tampered ciphertext (auth tag)', () => {
    const crypto = makeCrypto();
    const enc = crypto.encrypt('secret');
    const [iv, tag] = enc.split(':');
    const tampered = `${iv}:${tag}:${Buffer.from('evil').toString('base64')}`;
    expect(() => crypto.decrypt(tampered)).toThrow();
  });

  it('requires a 32-byte key', () => {
    expect(() => makeCrypto('short').encrypt('x')).toThrow();
    const noKey = new AesTokenCrypto({ get: () => undefined } as unknown as ConfigService);
    expect(() => noKey.encrypt('x')).toThrow();
  });
});
