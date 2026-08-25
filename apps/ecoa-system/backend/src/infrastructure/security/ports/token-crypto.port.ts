export const TOKEN_CRYPTO = Symbol('TOKEN_CRYPTO');

/**
 * Symmetric encryption for secrets stored at rest (Instagram access tokens).
 * The ciphertext is self-describing (iv:authTag:data) so a single string round-trips.
 */
export interface TokenCryptoPort {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}
