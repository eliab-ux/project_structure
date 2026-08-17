export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/**
 * Fronteira do hash de senha. O domínio não conhece bcrypt: para ele, senha vira uma string
 * opaca, e comparar é responsabilidade de quem sabe como ela foi gerada.
 */
export interface PasswordHasherPort {
  hash(plainPassword: string): Promise<string>;
  /** Comparação em tempo constante — é o `compare` do bcrypt, nunca `===`. */
  compare(plainPassword: string, hash: string): Promise<boolean>;
}
