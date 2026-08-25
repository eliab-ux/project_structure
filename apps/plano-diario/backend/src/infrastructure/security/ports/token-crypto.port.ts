export const TOKEN_CRYPTO = Symbol('TOKEN_CRYPTO');

/**
 * Criptografia simétrica de secrets guardados em repouso (o token da instância do WhatsApp).
 * O ciphertext é autodescritivo (`iv:authTag:data`), então uma única string faz o round-trip.
 */
export interface TokenCryptoPort {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}
