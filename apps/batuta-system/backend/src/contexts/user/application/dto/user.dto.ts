import { User } from '../../domain/entities/user.entity';
import { UserRole } from '../../domain/value-objects/user-role.vo';
import { UserStatus } from '../../domain/value-objects/user-status.vo';

/** `passwordHash` is intentionally absent — its absence is the point of this class. */
export class UserDto {
  id!: string;
  name!: string;
  email!: string;
  /**
   * Shown in full, not masked: this is the account's own team, and an admin has to be able to
   * check WHERE a recovery code would land. Logs and audit payloads use `PhoneE164.masked`.
   */
  phone!: string | null;
  role!: UserRole;
  status!: UserStatus;
  lastLoginAt!: Date | null;
  createdAt!: Date;

  static fromDomain(user: User): UserDto {
    const dto = new UserDto();
    dto.id = user.id.value;
    dto.name = user.name;
    dto.email = user.email.value;
    dto.phone = user.phone?.value ?? null;
    dto.role = user.role;
    dto.status = user.status;
    dto.lastLoginAt = user.lastLoginAt;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
