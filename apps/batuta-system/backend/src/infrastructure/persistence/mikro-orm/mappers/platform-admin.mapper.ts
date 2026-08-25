import { Injectable } from '@nestjs/common';
import { PlatformAdmin } from '../../../../contexts/platform/domain/entities/platform-admin.entity';
import { PlatformAdminId } from '../../../../contexts/platform/domain/value-objects/platform-admin-id.vo';
import { Email } from '../../../../contexts/user/domain/value-objects/email.vo';
import { PlatformAdminOrmEntity } from '../entities/platform-admin-orm.entity';

@Injectable()
export class PlatformAdminMapper {
  toDomain(orm: PlatformAdminOrmEntity): PlatformAdmin {
    return PlatformAdmin.reconstitute({
      id: PlatformAdminId.from(orm.id),
      name: orm.name,
      email: Email.create(orm.email),
      passwordHash: orm.passwordHash,
      active: orm.active,
      lastLoginAt: orm.lastLoginAt,
      createdAt: orm.createdAt,
    });
  }

  toOrmData(admin: PlatformAdmin): Record<string, unknown> {
    return {
      id: admin.id.value,
      name: admin.name,
      email: admin.email.value,
      passwordHash: admin.passwordHashForPersistence(),
      active: admin.active,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
    };
  }
}
