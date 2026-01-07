import { Injectable } from '@nestjs/common';
import { User } from '../../../../contexts/user/domain/entities/user.entity';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { Email } from '../../../../contexts/user/domain/value-objects/email.vo';
import { UserOrmEntity } from '../entities/user-orm.entity';

@Injectable()
export class UserMapper {
  toDomain(orm: UserOrmEntity): User {
    return User.reconstitute(
      UserId.from(orm.id),
      Email.create(orm.email),
      orm.name,
      orm.createdAt,
      orm.updatedAt,
      orm.isActive,
    );
  }

  toOrm(domain: User): UserOrmEntity {
    const orm = new UserOrmEntity();
    orm.id = domain.id.value;
    orm.email = domain.email.value;
    orm.name = domain.name;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    orm.isActive = domain.isActive;
    return orm;
  }

  toOrmPartial(domain: User, existing: UserOrmEntity): UserOrmEntity {
    existing.email = domain.email.value;
    existing.name = domain.name;
    existing.updatedAt = domain.updatedAt;
    existing.isActive = domain.isActive;
    return existing;
  }
}
