import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { AesTokenCrypto } from '../../../src/infrastructure/security/aes-token-crypto.service';

function cryptoWith(key: string | undefined): AesTokenCrypto {
  const config = { get: () => key } as unknown as ConfigService;
  return new AesTokenCrypto(config);
}

const CHAVE = randomBytes(32).toString('hex');

describe('AesTokenCrypto', () => {
  it('faz round-trip do token', () => {
    const crypto = cryptoWith(CHAVE);
    // Fixture com o mesmo formato de uma apikey de instância (32 chars), mas valor fictício.
    const token = 'FAKEtokenDeInstanciaParaTeste123X';
    expect(crypto.decrypt(crypto.encrypt(token))).toBe(token);
  });

  it('o ciphertext não contém o texto original', () => {
    const crypto = cryptoWith(CHAVE);
    const encrypted = crypto.encrypt('token-secreto-da-instancia');
    expect(encrypted).not.toContain('token-secreto');
  });

  it('cifra o mesmo valor de forma diferente a cada vez (IV aleatório)', () => {
    const crypto = cryptoWith(CHAVE);
    expect(crypto.encrypt('mesmo-token')).not.toBe(crypto.encrypt('mesmo-token'));
  });

  it('detecta adulteração do ciphertext (authTag do GCM)', () => {
    const crypto = cryptoWith(CHAVE);
    const [iv, tag] = crypto.encrypt('token').split(':');
    const adulterado = `${iv}:${tag}:${Buffer.from('outro-conteudo').toString('base64')}`;
    expect(() => crypto.decrypt(adulterado)).toThrow();
  });

  it('não decifra com outra chave', () => {
    const encrypted = cryptoWith(CHAVE).encrypt('token');
    const outra = cryptoWith(randomBytes(32).toString('hex'));
    expect(() => outra.decrypt(encrypted)).toThrow();
  });

  it('recusa ciphertext malformado', () => {
    expect(() => cryptoWith(CHAVE).decrypt('nao-tem-formato')).toThrow('Malformed encrypted token');
  });

  it('exige a ENCRYPTION_KEY configurada', () => {
    expect(() => cryptoWith(undefined).encrypt('x')).toThrow(/ENCRYPTION_KEY é obrigatória/);
  });

  it('exige chave de 32 bytes', () => {
    expect(() => cryptoWith('abcd').encrypt('x')).toThrow(/32 bytes/);
  });
});
