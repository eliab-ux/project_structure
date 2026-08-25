import { User } from '../../domain/entities/user.entity';

export class UserDto {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly name: string,
    public readonly role: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly isActive: boolean,
  ) {}

  static fromDomain(user: User): UserDto {
    return new UserDto(
      user.id.value,
      user.email.value,
      user.name,
      user.role.value,
      user.createdAt,
      user.updatedAt,
      user.isActive,
    );
  }
}
