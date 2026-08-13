import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@veertex/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { PermissionSet } from '../../../domain/value-objects/permission-set.vo';
import { RoleId } from '../../../domain/value-objects/role-id.vo';
import { RoleNotFoundException } from '../../../domain/exceptions/role-exceptions';
import { ROLE_REPOSITORY, RoleRepositoryPort } from '../../ports/output/role-repository.port';
import { RoleDto } from '../../dto/role.dto';
import { RoleAdministrationPolicy } from '../../policies/role-administration.policy';

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
    private readonly roleAdministration: RoleAdministrationPolicy,
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
      // Simulado ANTES de aplicar. A checagem anterior comparava `isAdministrative` (ter o curinga
      // `*`) antes e depois, e contava papéis com curinga — o que deixava passar a remoção do último
      // papel com `roles.update` EXPLÍCITO, trancando a conta. Ver `RoleAdministrationPolicy`.
      await this.roleAdministration.assertSurvives({
        kind: 'role-permissions',
        roleId: role.id.value,
        permissions: command.permissions,
      });

      role.changePermissions(PermissionSet.create(command.permissions));
    }

    return this.uow.execute(async () => {
      const saved = await this.roles.save(role);
      return RoleDto.fromDomain(saved);
    });
  }
}
