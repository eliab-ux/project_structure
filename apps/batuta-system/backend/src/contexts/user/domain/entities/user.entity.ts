import { AggregateRoot } from '@gitspread/domain-primitives';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { Email } from '../value-objects/email.vo';
import { UserId } from '../value-objects/user-id.vo';
import { UserRole } from '../value-objects/user-role.vo';
import { UserStatus } from '../value-objects/user-status.vo';
import { UserDisabledException } from '../exceptions/user-disabled.exception';

/**
 * A user of a tenant. Always bound to one `accountId` — there is no global user.
 *
 * The entity holds the password HASH, never the plaintext, and never exposes it through a
 * getter that a response DTO could pick up by accident: verification goes through
 * `matchesPasswordHash`, and persistence reads it via `passwordHashForPersistence()`, whose
 * name makes an accidental HTTP leak obvious in review.
 *
 * Name, e-mail AND WhatsApp are all required on creation (CLAUDE.md, regra 9): password recovery
 * is a code sent over WhatsApp, so a user without a number is a user who loses the account at the
 * first forgotten password. `phone` is nullable only in `reconstitute`, and only because rows
 * created before the column existed have to be readable — see the migration.
 */
export class User extends AggregateRoot {
  private constructor(
    private readonly _id: UserId,
    private readonly _accountId: string,
    private _name: string,
    private _email: Email,
    private _phone: PhoneE164 | null,
    private _passwordHash: string,
    private _role: UserRole,
    private _status: UserStatus,
    private _lastLoginAt: Date | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    name: string;
    email: Email;
    /** Required — not `| null`. The type is the rule. */
    phone: PhoneE164;
    passwordHash: string;
    role: UserRole;
  }): User {
    return new User(
      UserId.generate(),
      params.accountId,
      params.name.trim(),
      params.email,
      params.phone,
      params.passwordHash,
      params.role,
      UserStatus.ACTIVE,
      null,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: UserId;
    accountId: string;
    name: string;
    email: Email;
    phone: PhoneE164 | null;
    passwordHash: string;
    role: UserRole;
    status: UserStatus;
    lastLoginAt: Date | null;
    createdAt: Date;
  }): User {
    return new User(
      params.id,
      params.accountId,
      params.name,
      params.email,
      params.phone,
      params.passwordHash,
      params.role,
      params.status,
      params.lastLoginAt,
      params.createdAt,
    );
  }

  get id(): UserId {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get name(): string {
    return this._name;
  }

  get email(): Email {
    return this._email;
  }

  /**
   * `null` only for rows that predate the column. Every user created through the API has one, and
   * the recovery flow treats the absence as "this account cannot be recovered by code".
   */
  get phone(): PhoneE164 | null {
    return this._phone;
  }

  get role(): UserRole {
    return this._role;
  }

  get status(): UserStatus {
    return this._status;
  }

  get lastLoginAt(): Date | null {
    return this._lastLoginAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get isActive(): boolean {
    return this._status === UserStatus.ACTIVE;
  }

  get isAccountAdmin(): boolean {
    return this._role === UserRole.ACCOUNT_ADMIN;
  }

  /** Only the persistence mapper is allowed to read this. Never map it into a ResponseDto. */
  passwordHashForPersistence(): string {
    return this._passwordHash;
  }

  assertCanAuthenticate(): void {
    if (!this.isActive) {
      throw new UserDisabledException();
    }
  }

  registerSuccessfulLogin(): void {
    this._lastLoginAt = new Date();
  }

  changePasswordHash(passwordHash: string): void {
    this._passwordHash = passwordHash;
  }

  changeName(name: string): void {
    this._name = name.trim();
  }

  /**
   * Changing the number changes where a recovery code goes, so this is a security-relevant edit:
   * the caller must record it in the audit trail.
   */
  changePhone(phone: PhoneE164): void {
    this._phone = phone;
  }

  changeRole(role: UserRole): void {
    this._role = role;
  }

  disable(): void {
    this._status = UserStatus.DISABLED;
  }

  enable(): void {
    this._status = UserStatus.ACTIVE;
  }
}
