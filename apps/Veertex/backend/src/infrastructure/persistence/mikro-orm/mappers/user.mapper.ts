import { Injectable } from '@nestjs/common';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { User } from '../../../../contexts/user/domain/entities/user.entity';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { AccessWindow } from '../../../../contexts/user/domain/value-objects/access-window.vo';
import { CommissionModel } from '../../../../contexts/user/domain/commission-model';
import { UserOrmEntity } from '../entities/user-orm.entity';

@Injectable()
export class UserMapper {
  toDomain(orm: UserOrmEntity): User {
    return User.reconstitute({
      id: UserId.from(orm.id),
      accountId: orm.accountId,
      name: orm.name,
      email: Email.create(orm.email),
      // NOT NULL in the schema, so no null branch here: the type and the column agree, and a row
      // that violated it would fail loudly rather than produce a user who cannot be recovered.
      phone: PhoneE164.create(orm.phone),
      passwordHash: orm.passwordHash,
      roleId: orm.roleId,
      status: orm.status,
      accessWindows: orm.accessWindows?.map((window) => AccessWindow.create(window)) ?? null,
      lastLoginAt: orm.lastLoginAt,
      commissionModel: orm.commissionModel as CommissionModel,
      createdAt: orm.createdAt,
    });
  }

  toOrmData(user: User): Record<string, unknown> {
    return {
      id: user.id.value,
      accountId: user.accountId,
      name: user.name,
      email: user.email.value,
      phone: user.phone.value,
      passwordHash: user.passwordHashForPersistence(),
      roleId: user.roleId,
      status: user.status,
      accessWindows: user.accessWindows?.map((window) => window.toJSON()) ?? null,
      lastLoginAt: user.lastLoginAt,
      commissionModel: user.commissionModel,
      createdAt: user.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    };
  }
}
