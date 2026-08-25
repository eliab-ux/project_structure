import { ValueObject } from '@gitspread/domain-primitives';

export type UserRoleValue = 'customer' | 'reseller' | 'admin';

export class UserRole extends ValueObject<{ value: UserRoleValue }> {
  static readonly CUSTOMER = new UserRole({ value: 'customer' });
  static readonly RESELLER = new UserRole({ value: 'reseller' });
  static readonly ADMIN = new UserRole({ value: 'admin' });

  private constructor(props: { value: UserRoleValue }) {
    super(props);
  }

  get value(): UserRoleValue {
    return this.props.value;
  }

  static from(value: string | null | undefined): UserRole {
    if (!value) {
      return UserRole.CUSTOMER; // Default role
    }

    const normalized = value.toLowerCase();
    switch (normalized) {
      case 'customer':
        return UserRole.CUSTOMER;
      case 'reseller':
        return UserRole.RESELLER;
      case 'admin':
        return UserRole.ADMIN;
      default:
        throw new Error(`Invalid user role: ${value}`);
    }
  }
}
