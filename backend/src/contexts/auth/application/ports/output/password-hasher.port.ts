export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/**
 * Hashing boundary. The application never learns which algorithm is used, which is what makes
 * changing the cost factor — or the algorithm — a one-file change.
 */
export interface PasswordHasherPort {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}
