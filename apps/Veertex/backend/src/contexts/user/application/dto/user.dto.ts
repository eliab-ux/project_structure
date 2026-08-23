import { User } from '../../domain/entities/user.entity';

/**
 * Application-boundary view of a user.
 *
 * `passwordHash` is not mapped — the absence is intentional and load-bearing, not an oversight.
 * The phone IS included: an account admin managing users needs to see where a recovery code would
 * go, and it is their own account's data. It never reaches a log in this form (see `PhoneE164.masked`).
 */
export class UserDto {
  id!: string;
  name!: string;
  email!: string;
  phone!: string;
  roleId!: string;
  status!: string;
  commissionModel!: string;
  lastLoginAt!: Date | null;
  createdAt!: Date;

  static fromDomain(user: User): UserDto {
    const dto = new UserDto();
    dto.id = user.id.value;
    dto.name = user.name;
    dto.email = user.email.value;
    dto.phone = user.phone.value;
    dto.roleId = user.roleId;
    dto.status = user.status;
    dto.commissionModel = user.commissionModel;
    dto.lastLoginAt = user.lastLoginAt;
    dto.createdAt = user.createdAt;
    // passwordHash nunca é mapeado — ausência intencional.
    return dto;
  }
}
