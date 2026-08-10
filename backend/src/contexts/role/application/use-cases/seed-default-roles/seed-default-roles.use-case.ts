import { Injectable } from '@nestjs/common';
import { Role } from '../../../domain/entities/role.entity';
import { PermissionSet } from '../../../domain/value-objects/permission-set.vo';
import { DEFAULT_ROLES } from '../../../domain/default-roles';

/**
 * Builds the seven default roles for a brand-new account.
 *
 * Returns entities instead of persisting them: it is called from inside the onboarding transaction,
 * which saves the account, the roles, the first company and the admin user together. A use case
 * that saved on its own would either open a nested transaction for no reason or, worse, leave
 * orphan roles behind when a later step of the onboarding failed.
 */
@Injectable()
export class SeedDefaultRolesUseCase {
  build(accountId: string): Role[] {
    return DEFAULT_ROLES.map((definition) =>
      Role.create({
        accountId,
        code: definition.code,
        name: definition.name,
        description: definition.description,
        permissions: PermissionSet.create(definition.permissions),
        isSystem: true,
      }),
    );
  }
}
