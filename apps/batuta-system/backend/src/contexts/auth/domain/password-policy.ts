import { WeakPasswordException } from './exceptions/weak-password.exception';

const MIN_LENGTH = 10;
/** Same cap bcrypt itself has: bytes past 72 are silently ignored, so accepting more misleads. */
const MAX_LENGTH = 72;

/**
 * Password policy, in the domain so HTTP and reset flows cannot disagree about it.
 *
 * Length first, character classes second — that is the ordering that actually correlates with
 * resistance to guessing. No forced rotation, no symbol requirement.
 */
export function assertStrongPassword(plain: string): void {
  const password = plain ?? '';
  const longEnough = password.length >= MIN_LENGTH && password.length <= MAX_LENGTH;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);

  if (!longEnough || !hasLetter || !hasDigit) {
    throw new WeakPasswordException();
  }
}

export const PASSWORD_POLICY = { minLength: MIN_LENGTH, maxLength: MAX_LENGTH };
