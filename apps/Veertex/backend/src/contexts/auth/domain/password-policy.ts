import { DomainException } from '@veertex/domain-primitives';

export class WeakPasswordException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

/**
 * One definition of "an acceptable password", used by the DTOs (for the message the user sees
 * while typing) and by the domain (for the guarantee). Not an environment variable: a policy that
 * differs between environments means the password that works in staging fails in production.
 *
 * `maxLength` is not cosmetic — bcrypt silently truncates at 72 bytes, so a longer password would
 * quietly have its tail ignored, and a 200-character one is also a cheap way to make the server
 * burn CPU on hashing.
 */
export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 72,
} as const;

/**
 * Length only, deliberately. Composition rules ("uma maiúscula, um símbolo") push people toward
 * `Senha@123` — predictable to an attacker and hard for the user — while length is what actually
 * costs a cracker time. Revisit if a customer's own compliance requires otherwise.
 */
export function assertPasswordStrength(password: string): void {
  const value = password ?? '';

  if (value.length < PASSWORD_POLICY.minLength) {
    throw new WeakPasswordException(
      `A senha deve ter no mínimo ${PASSWORD_POLICY.minLength} caracteres.`,
    );
  }
  if (value.length > PASSWORD_POLICY.maxLength) {
    throw new WeakPasswordException(
      `A senha deve ter no máximo ${PASSWORD_POLICY.maxLength} caracteres.`,
    );
  }
}
