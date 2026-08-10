import { Injectable } from '@nestjs/common';
import { Role } from '../../../../contexts/role/domain/entities/role.entity';
import { RoleId } from '../../../../contexts/role/domain/value-objects/role-id.vo';
import { PermissionSet } from '../../../../contexts/role/domain/value-objects/permission-set.vo';
import { isKnownPermission } from '../../../../contexts/role/domain/permissions.catalog';
import { RoleOrmEntity } from '../entities/role-orm.entity';

@Injectable()
export class RoleMapper {
  toDomain(orm: RoleOrmEntity): Role {
    return Role.reconstitute({
      id: RoleId.from(orm.id),
      accountId: orm.accountId,
      code: orm.code,
      name: orm.name,
      description: orm.description,
      // Stored permissions are filtered against the current catalogue instead of validated.
      // A permission removed from the code in a later release would otherwise make every read of
      // that role throw — locking the account out of the very screen where it could be fixed.
      // Unknown entries are dropped on read and disappear on the next save.
      permissions: PermissionSet.create((orm.permissions ?? []).filter(isKnownPermission)),
      isSystem: orm.isSystem,
      createdAt: orm.createdAt,
    });
  }

  toOrmData(role: Role): Record<string, unknown> {
    return {
      id: role.id.value,
      accountId: role.accountId,
      code: role.code,
      name: role.name,
      description: role.description,
      permissions: [...role.permissions.values],
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    };
  }
}
