import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { PermissionSet } from '../../../domain/value-objects/permission-set.vo';
import { RoleId } from '../../../domain/value-objects/role-id.vo';
import {
  LastAdministrativeRoleException,
  RoleNotFoundException,
} from '../../../domain/exceptions/role-exceptions';
import { ROLE_REPOSITORY, RoleRepositoryPort } from '../../ports/output/role-repository.port';
import { RoleDto } from '../../dto/role.dto';

export class UpdateRoleCommand {
  constructor(
    public readonly roleId: string,
    public readonly name?: string,
    public readonly description?: string | null,
    public readonly permissions?: string[],
  ) {}
}

/**
 * Renames a role and adjusts its permissions — allowed on system roles too (01 §3.3: the defaults
 * are "ajustáveis por conta"). The `code` is never editable: users and the CLI reference it.
 */
@Injectable()
export class UpdateRoleUseCase implements UseCase<UpdateRoleCommand, RoleDto> {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateRoleCommand): Promise<RoleDto> {
    const role = await this.roles.findById(RoleId.from(command.roleId));
    if (!role) {
      throw new RoleNotFoundException();
    }

    if (command.name !== undefined) {
      role.rename(command.name, command.description);
    } else if (command.description !== undefined) {
      role.rename(role.name, command.description);
    }

    if (command.permissions) {
      const wasAdministrative = role.isAdministrative;
      role.changePermissions(PermissionSet.create(command.permissions));

      // Stripping the last administrative role locks everyone out of user and role management, and
      // nothing inside the product could undo it — only a database edit. Refused.
      if (wasAdministrative && !role.isAdministrative) {
        const remaining = await this.roles.countAdministrative();
        if (remaining <= 1) {
          throw new LastAdministrativeRoleException();
        }
      }
    }

    return this.uow.execute(async () => {
      const saved = await this.roles.save(role);
      return RoleDto.fromDomain(saved);
    });
  }
}
