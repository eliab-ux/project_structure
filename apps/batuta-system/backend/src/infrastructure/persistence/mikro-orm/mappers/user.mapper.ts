import { Injectable } from '@nestjs/common';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { User } from '../../../../contexts/user/domain/entities/user.entity';
import { Email } from '../../../../contexts/user/domain/value-objects/email.vo';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { UserOrmEntity } from '../entities/user-orm.entity';

@Injectable()
export class UserMapper {
  toDomain(orm: UserOrmEntity): User {
    return User.reconstitute({
      id: UserId.from(orm.id),
      accountId: orm.accountId,
      name: orm.name,
      email: Email.create(orm.email),
      phone: orm.phone ? PhoneE164.create(orm.phone) : null,
      passwordHash: orm.passwordHash,
      role: orm.role,
      status: orm.status,
      lastLoginAt: orm.lastLoginAt,
      createdAt: orm.createdAt,
    });
  }

  toOrmData(user: User): Record<string, unknown> {
    return {
      id: user.id.value,
      accountId: user.accountId,
      name: user.name,
      email: user.email.value,
      phone: user.phone?.value ?? null,
      passwordHash: user.passwordHashForPersistence(),
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
