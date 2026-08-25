import { Injectable } from '@nestjs/common';
import { User } from '../../../../contexts/user/domain/entities/user.entity';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { Email } from '../../../../contexts/user/domain/value-objects/email.vo';
import { UserRole } from '../../../../contexts/user/domain/value-objects/user-role.vo';
import { UserOrmEntity } from '../entities/user-orm.entity';

@Injectable()
export class UserMapper {
  toDomain(orm: UserOrmEntity): User {
    return User.reconstitute(
      UserId.from(orm.id),
      Email.create(orm.email),
      orm.name,
      orm.passwordHash,
      UserRole.from(orm.role),
      orm.active,
      orm.createdAt,
      orm.updatedAt,
      orm.resetToken ?? null,
      orm.resetTokenExpiresAt ?? null,
    );
  }

  toOrm(domain: User, existing?: UserOrmEntity): UserOrmEntity {
    const orm = existing ?? new UserOrmEntity();
    orm.id = domain.id.value;
    orm.email = domain.email.value;
    orm.name = domain.name;
    orm.passwordHash = domain.passwordHash;
    orm.role = domain.role.value;
    orm.active = domain.active;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    orm.resetToken = domain.resetToken;
    orm.resetTokenExpiresAt = domain.resetTokenExpiresAt;
    return orm;
  }
}
