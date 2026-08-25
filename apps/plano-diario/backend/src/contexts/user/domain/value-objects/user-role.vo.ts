import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidUserRoleException } from '../exceptions/invalid-user-role.exception';

export type UserRoleValue = 'user' | 'admin';

export class UserRole extends ValueObject<{ value: UserRoleValue }> {
  static readonly USER = new UserRole({ value: 'user' });
  static readonly ADMIN = new UserRole({ value: 'admin' });

  private constructor(props: { value: UserRoleValue }) {
    super(props);
  }

  static from(value: string | null | undefined): UserRole {
    if (!value) {
      return UserRole.USER;
    }
    switch (value.toLowerCase()) {
      case 'user':
        return UserRole.USER;
      case 'admin':
        return UserRole.ADMIN;
      default:
        throw new InvalidUserRoleException(value);
    }
  }

  get value(): UserRoleValue {
    return this.props.value;
  }

  get isAdmin(): boolean {
    return this.props.value === 'admin';
  }
}
