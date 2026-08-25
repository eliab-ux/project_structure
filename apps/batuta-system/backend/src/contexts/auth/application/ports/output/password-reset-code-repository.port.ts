import { PasswordResetCode } from '../../../domain/entities/password-reset-code.entity';

export const PASSWORD_RESET_CODE_REPOSITORY = Symbol('PASSWORD_RESET_CODE_REPOSITORY');

/**
 * Every method here runs with the tenant filter DISABLED, and that is not an oversight.
 *
 * A "forgot my password" request carries no JWT, so there is no tenant scope to run under. What
 * protects these rows instead is the code: six digits kept only as a bcrypt hash, single use, 15
 * minutes, five attempts. The `userId` is always resolved first from the e-mail, and the `accountId`
 * is read from the row — never taken from the request.
 */
export interface PasswordResetCodeRepositoryPort {
  save(code: PasswordResetCode): Promise<PasswordResetCode>;

  /**
   * The user's most recent unused code. Only one is ever alive: asking for a new one invalidates
   * the previous, because two valid codes would double the guessing surface.
   */
  findLatestUnused(userId: string): Promise<PasswordResetCode | null>;

  /**
   * Basis of the per-hour limit — it keeps the user's WhatsApp from becoming a spam channel.
   *
   * Counts only codes that were actually SENT. Counting attempts would let an infrastructure
   * failure consume the user's quota and block recovery for an hour without one message going out.
   */
  countSentSince(userId: string, since: Date): Promise<number>;

  /** Marks every live code of the user as used. */
  invalidateAllForUser(userId: string, now: Date): Promise<void>;
}
