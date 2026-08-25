import { User } from '../../domain/entities/user.entity';

/** Application-boundary view of a user. Never carries passwordHash or reset token. */
export class UserDto {
  id!: string;
  email!: string;
  name!: string;
  role!: string;
  active!: boolean;
  createdAt!: Date;

  static fromDomain(user: User): UserDto {
    const dto = new UserDto();
    dto.id = user.id.value;
    dto.email = user.email.value;
    dto.name = user.name;
    dto.role = user.role.value;
    dto.active = user.active;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
