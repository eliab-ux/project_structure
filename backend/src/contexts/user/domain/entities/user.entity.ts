import { AggregateRoot } from '@veertex/domain-primitives';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { AccessWindow } from '../value-objects/access-window.vo';
import { UserId } from '../value-objects/user-id.vo';
import { UserStatus } from '../value-objects/user-status.vo';
import { UserDisabledException } from '../exceptions/user-exceptions';

/**
 * A user of a tenant. Always bound to one `accountId` — there is no global user.
 *
 * **Name, e-mail AND WhatsApp are all required, in every constructor** (CLAUDE.md regra 9). The
 * types say so: `phone` is `PhoneE164`, never `PhoneE164 | null`, in `create` *and* in
 * `reconstitute`. That differs from the older systems in this monorepo, where the column arrived
 * after the table had rows and had to be nullable — Veertex is greenfield, so the exception the
 * rule allows does not apply and the column is `NOT NULL` from the first migration. Password
 * recovery is a code sent over WhatsApp; a user without a number is a user who loses the account at
 * the first forgotten password, recoverable only with database access.
 *
 * The entity holds the password HASH, never the plaintext, and never exposes it through a getter a
 * response DTO could pick up by accident: verification goes through the hasher in the use case, and
 * persistence reads it via `passwordHashForPersistence()`, whose name makes an accidental HTTP leak
 * obvious in review.
 */
export class User extends AggregateRoot {
  private constructor(
    private readonly _id: UserId,
    private readonly _accountId: string,
    private _name: string,
    private _email: Email,
    private _phone: PhoneE164,
    private _passwordHash: string,
    private _roleId: string,
    private _status: UserStatus,
    private _accessWindows: AccessWindow[] | null,
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
    roleId: string;
    id?: UserId;
  }): User {
    return new User(
      params.id ?? UserId.generate(),
      params.accountId,
      params.name.trim(),
      params.email,
      params.phone,
      params.passwordHash,
      params.roleId,
      UserStatus.ACTIVE,
      null,
      null,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: UserId;
    accountId: string;
    name: string;
    email: Email;
    phone: PhoneE164;
    passwordHash: string;
    roleId: string;
    status: UserStatus;
    accessWindows: AccessWindow[] | null;
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
      params.roleId,
      params.status,
      params.accessWindows,
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

  /** First name only — what a WhatsApp greeting uses. */
  get firstName(): string {
    return this._name.split(' ')[0];
  }

  get email(): Email {
    return this._email;
  }

  get phone(): PhoneE164 {
    return this._phone;
  }

  get roleId(): string {
    return this._roleId;
  }

  get status(): UserStatus {
    return this._status;
  }

  /** `null` = no restriction. Modelled but not enforced in F1 — see AccessWindow. */
  get accessWindows(): readonly AccessWindow[] | null {
    return this._accessWindows;
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

  changeEmail(email: Email): void {
    this._email = email;
  }

  /**
   * Changing the number changes where a recovery code goes, so this is a security-relevant edit —
   * the caller is expected to record it in the audit trail once that module exists.
   */
  changePhone(phone: PhoneE164): void {
    this._phone = phone;
  }

  changeRole(roleId: string): void {
    this._roleId = roleId;
  }

  changeAccessWindows(windows: AccessWindow[] | null): void {
    this._accessWindows = windows;
  }

  disable(): void {
    this._status = UserStatus.DISABLED;
  }

  enable(): void {
    this._status = UserStatus.ACTIVE;
  }
}
