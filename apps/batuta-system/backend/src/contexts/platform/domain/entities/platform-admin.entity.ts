import { AggregateRoot } from '@gitspread/domain-primitives';
import { Email } from '../../../user/domain/value-objects/email.vo';
import { UserDisabledException } from '../../../user/domain/exceptions/user-disabled.exception';
import { PlatformAdminId } from '../value-objects/platform-admin-id.vo';

/**
 * Operator of the platform itself (global ceilings, abuse signals, suspension).
 *
 * Deliberately NOT a `User` with an extra role: a platform admin has no `accountId` at all, so
 * there is no code path where a null tenant scope silently turns into "sees everything"
 * (BATUTA_SPEC §4).
 */
export class PlatformAdmin extends AggregateRoot {
  private constructor(
    private readonly _id: PlatformAdminId,
    private _name: string,
    private _email: Email,
    private _passwordHash: string,
    private _active: boolean,
    private _lastLoginAt: Date | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: { name: string; email: Email; passwordHash: string }): PlatformAdmin {
    return new PlatformAdmin(
      PlatformAdminId.generate(),
      params.name.trim(),
      params.email,
      params.passwordHash,
      true,
      null,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: PlatformAdminId;
    name: string;
    email: Email;
    passwordHash: string;
    active: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  }): PlatformAdmin {
    return new PlatformAdmin(
      params.id,
      params.name,
      params.email,
      params.passwordHash,
      params.active,
      params.lastLoginAt,
      params.createdAt,
    );
  }

  get id(): PlatformAdminId {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get email(): Email {
    return this._email;
  }

  get active(): boolean {
    return this._active;
  }

  get lastLoginAt(): Date | null {
    return this._lastLoginAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  /** Only the persistence mapper reads this. Never map it into a ResponseDto. */
  passwordHashForPersistence(): string {
    return this._passwordHash;
  }

  assertCanAuthenticate(): void {
    if (!this._active) {
      throw new UserDisabledException();
    }
  }

  registerSuccessfulLogin(): void {
    this._lastLoginAt = new Date();
  }

  changePasswordHash(passwordHash: string): void {
    this._passwordHash = passwordHash;
  }
}
