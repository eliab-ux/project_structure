import { ValueObject } from '@gitspread/domain-primitives';

export type UserRoleValue = 'user' | 'admin';

export class UserRole extends ValueObject<{ value: UserRoleValue }> {
  static readonly USER = new UserRole({ value: 'user' });
  static readonly ADMIN = new UserRole({ value: 'admin' });

  private constructor(props: { value: UserRoleValue }) {
    super(props);
  }

  get value(): UserRoleValue {
    return this.props.value;
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
        throw new Error(`Invalid user role: ${value}`);
    }
  }
}
