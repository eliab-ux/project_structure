import { Injectable } from '@nestjs/common';
import { User } from '../../../../contexts/user/domain/entities/user.entity';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { assertUserRole } from '../../../../contexts/user/domain/value-objects/user-role.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { UserOrmEntity } from '../entities/user-orm.entity';

@Injectable()
export class UserMapper {
  toDomain(orm: UserOrmEntity): User {
    return User.restore({
      id: UserId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      name: orm.name,
      email: Email.create(orm.email),
      phone: PhoneE164.create(orm.phone),
      passwordHash: orm.passwordHash,
      // O papel é revalidado na volta do banco: a coluna é varchar com CHECK, e um valor
      // introduzido por SQL manual não pode virar um papel desconhecido circulando no sistema.
      role: assertUserRole(orm.role),
      isActive: orm.isActive,
      mustChangePassword: orm.mustChangePassword,
      lastLoginAt: orm.lastLoginAt,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(domain: User, target: UserOrmEntity = new UserOrmEntity()): UserOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.name = domain.name;
    target.email = domain.email.value;
    target.phone = domain.phone.value;
    target.passwordHash = domain.passwordHash;
    target.role = domain.role;
    target.isActive = domain.isActive;
    target.mustChangePassword = domain.mustChangePassword;
    target.lastLoginAt = domain.lastLoginAt;
    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}
