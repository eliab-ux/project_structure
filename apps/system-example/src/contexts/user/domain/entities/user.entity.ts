import { AggregateRoot } from '@gitspread/domain-primitives';
import { UserId } from '../value-objects/user-id.vo';
import { Email } from '../value-objects/email.vo';
import { UserCreatedEvent } from '../events/user-created.event';
import { UserEmailChangedEvent } from '../events/user-email-changed.event';

export class User extends AggregateRoot {
  private constructor(
    private readonly _id: UserId,
    private _email: Email,
    private _name: string,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _isActive: boolean = true,
  ) {
    super();
  }

  static create(email: Email, name: string): User {
    if (!name || name.trim().length === 0) {
      throw new Error('User name cannot be empty');
    }

    if (name.length < 2 || name.length > 100) {
      throw new Error('User name must be between 2 and 100 characters');
    }

    const now = new Date();
    const user = new User(UserId.generate(), email, name.trim(), now, now, true);

    user.addDomainEvent(new UserCreatedEvent(user._id.value, user._email.value, user._name));

    return user;
  }

  static reconstitute(
    id: UserId,
    email: Email,
    name: string,
    createdAt: Date,
    updatedAt: Date,
    isActive: boolean,
  ): User {
    return new User(id, email, name, createdAt, updatedAt, isActive);
  }

  changeEmail(newEmail: Email): void {
    if (this._email.equals(newEmail)) {
      return;
    }

    const oldEmail = this._email.value;
    this._email = newEmail;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new UserEmailChangedEvent(this._id.value, oldEmail, newEmail.value),
    );
  }

  changeName(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error('User name cannot be empty');
    }

    if (newName.length < 2 || newName.length > 100) {
      throw new Error('User name must be between 2 and 100 characters');
    }

    this._name = newName.trim();
    this._updatedAt = new Date();
  }

  deactivate(): void {
    if (!this._isActive) {
      return;
    }

    this._isActive = false;
    this._updatedAt = new Date();
  }

  activate(): void {
    if (this._isActive) {
      return;
    }

    this._isActive = true;
    this._updatedAt = new Date();
  }

  // Getters
  get id(): UserId {
    return this._id;
  }

  get email(): Email {
    return this._email;
  }

  get name(): string {
    return this._name;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get isActive(): boolean {
    return this._isActive;
  }
}
