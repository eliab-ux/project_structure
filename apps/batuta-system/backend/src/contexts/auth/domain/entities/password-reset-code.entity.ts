import { AggregateRoot } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

/** Life of the code. Short because the channel (WhatsApp) is instantaneous. */
export const RESET_CODE_TTL_MINUTES = 15;

/**
 * How many wrong guesses a code tolerates before it dies. Six digits are 1,000,000 combinations;
 * five attempts leave the chance of a lucky guess at 0.0005%.
 */
export const RESET_CODE_MAX_ATTEMPTS = 5;

/**
 * The single-use code that authorises a password change.
 *
 * The code in the clear is **never stored**: the entity only ever knows its bcrypt hash. Whoever
 * knows the six digits is the owner of the WhatsApp that received them — neither a database dump
 * nor a log line reveals the value.
 *
 * Carries `accountId` because every row in this system belongs to a tenant (§4). The recovery flow
 * itself is anonymous — there is no JWT on a "forgot my password" request — so the accountId is
 * READ from the user found by e-mail and used to scope what follows; it never comes from the client.
 */
export class PasswordResetCode extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _userId: string,
    private readonly _codeHash: string,
    private readonly _expiresAt: Date,
    private _usedAt: Date | null,
    private _sentAt: Date | null,
    private _attempts: number,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static issue(params: {
    accountId: string;
    userId: string;
    codeHash: string;
    now?: Date;
  }): PasswordResetCode {
    const now = params.now ?? new Date();
    return new PasswordResetCode(
      randomUUID(),
      params.accountId,
      params.userId,
      params.codeHash,
      new Date(now.getTime() + RESET_CODE_TTL_MINUTES * 60_000),
      null,
      null,
      0,
      now,
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    userId: string;
    codeHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    sentAt: Date | null;
    attempts: number;
    createdAt: Date;
  }): PasswordResetCode {
    return new PasswordResetCode(
      params.id,
      params.accountId,
      params.userId,
      params.codeHash,
      params.expiresAt,
      params.usedAt,
      params.sentAt,
      params.attempts,
      params.createdAt,
    );
  }

  /**
   * Records that the message actually went out.
   *
   * Separate from creation because the per-hour limit counts **sends**, not attempts: the limit
   * exists so the user's WhatsApp does not become a spam channel, and a message that never left
   * spammed nobody. Counting attempts would let an infrastructure failure burn the user's quota and
   * lock recovery for an hour without a single message having been delivered.
   */
  markSent(now: Date = new Date()): void {
    this._sentAt = now;
  }

  /** Still usable: not expired, not used, attempts left. */
  isUsable(now: Date = new Date()): boolean {
    return !this.isExpired(now) && this._usedAt === null && this.hasAttemptsLeft;
  }

  isExpired(now: Date = new Date()): boolean {
    return now.getTime() >= this._expiresAt.getTime();
  }

  get hasAttemptsLeft(): boolean {
    return this._attempts < RESET_CODE_MAX_ATTEMPTS;
  }

  /** Counting a wrong guess ALWAYS, even on the failure path, is what bounds brute force. */
  registerFailedAttempt(): void {
    this._attempts += 1;
  }

  markUsed(now: Date = new Date()): void {
    this._usedAt = now;
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get userId(): string {
    return this._userId;
  }

  get codeHash(): string {
    return this._codeHash;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  get usedAt(): Date | null {
    return this._usedAt;
  }

  /** `null` = the message never left. Does not count towards the per-hour limit. */
  get sentAt(): Date | null {
    return this._sentAt;
  }

  get attempts(): number {
    return this._attempts;
  }

  get createdAt(): Date {
    return this._createdAt;
  }
}
