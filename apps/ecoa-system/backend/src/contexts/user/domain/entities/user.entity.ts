import { AggregateRoot } from '@gitspread/domain-primitives';
import { UserId } from '../value-objects/user-id.vo';
import { Email } from '../value-objects/email.vo';
import { UserRole } from '../value-objects/user-role.vo';
import { UserRegisteredEvent } from '../events/user-registered.event';

/**
 * The tenant. Owns every piece of business data in the system. Identity is fully local
 * (email + password); the Instagram connection is a separate, revocable link — revoking it
 * never locks the user out of their own account.
 */
export class User extends AggregateRoot {
  private constructor(
    private readonly _id: UserId,
    private _email: Email,
    private _name: string,
    private _passwordHash: string,
    private _role: UserRole,
    private _active: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _resetToken: string | null,
    private _resetTokenExpiresAt: Date | null,
  ) {
    super();
  }

  static register(email: Email, name: string, passwordHash: string): User {
    const trimmed = (name ?? '').trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      throw new Error('User name must be between 2 and 100 characters');
    }
    const now = new Date();
    const user = new User(
      UserId.generate(),
      email,
      trimmed,
      passwordHash,
      UserRole.USER,
      true,
      now,
      now,
      null,
      null,
    );
    user.addDomainEvent(new UserRegisteredEvent(user._id.value, email.value, trimmed));
    return user;
  }

  static reconstitute(
    id: UserId,
    email: Email,
    name: string,
    passwordHash: string,
    role: UserRole,
    active: boolean,
    createdAt: Date,
    updatedAt: Date,
    resetToken: string | null,
    resetTokenExpiresAt: Date | null,
  ): User {
    return new User(
      id,
      email,
      name,
      passwordHash,
      role,
      active,
      createdAt,
      updatedAt,
      resetToken,
      resetTokenExpiresAt,
    );
  }

  changePassword(newPasswordHash: string): void {
    this._passwordHash = newPasswordHash;
    this._resetToken = null;
    this._resetTokenExpiresAt = null;
    this._updatedAt = new Date();
  }

  setPasswordResetToken(token: string, expiresAt: Date): void {
    this._resetToken = token;
    this._resetTokenExpiresAt = expiresAt;
    this._updatedAt = new Date();
  }

  isResetTokenValid(token: string, now: Date = new Date()): boolean {
    return (
      !!this._resetToken &&
      this._resetToken === token &&
      !!this._resetTokenExpiresAt &&
      this._resetTokenExpiresAt.getTime() > now.getTime()
    );
  }

  deactivate(): void {
    this._active = false;
    this._updatedAt = new Date();
  }

  get id(): UserId {
    return this._id;
  }
  get email(): Email {
    return this._email;
  }
  get name(): string {
    return this._name;
  }
  get passwordHash(): string {
    return this._passwordHash;
  }
  get role(): UserRole {
    return this._role;
  }
  get active(): boolean {
    return this._active;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get resetToken(): string | null {
    return this._resetToken;
  }
  get resetTokenExpiresAt(): Date | null {
    return this._resetTokenExpiresAt;
  }
}
