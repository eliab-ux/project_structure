import { Injectable } from '@nestjs/common';
import { User } from '../../../../contexts/user/domain/entities/user.entity';
import { Email } from '../../../../contexts/user/domain/value-objects/email.vo';
import { PhoneNumber } from '../../../../contexts/user/domain/value-objects/phone-number.vo';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
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
      orm.phone ? PhoneNumber.create(orm.phone) : null,
      UserRole.from(orm.role),
      orm.isActive,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  /** `existing` permite atualizar a instância gerenciada pelo EntityManager em vez de duplicar. */
  toOrm(domain: User, existing?: UserOrmEntity): UserOrmEntity {
    const orm = existing ?? new UserOrmEntity();
    orm.id = domain.id.value;
    orm.email = domain.email.value;
    orm.passwordHash = domain.passwordHash;
    orm.name = domain.name;
    orm.phone = domain.phone?.value ?? null;
    orm.role = domain.role.value;
    orm.isActive = domain.isActive;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
