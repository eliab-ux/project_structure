import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@veertex/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { RoleId } from '../../../domain/value-objects/role-id.vo';
import {
  RoleInUseException,
  RoleNotFoundException,
} from '../../../domain/exceptions/role-exceptions';
import { ROLE_REPOSITORY, RoleRepositoryPort } from '../../ports/output/role-repository.port';

export class DeleteRoleCommand {
  constructor(public readonly roleId: string) {}
}

/**
 * Soft-deletes a custom role.
 *
 * Two refusals, both about not producing an unusable state: a system role is never deleted (the
 * onboarding and the CLI look roles up by code), and a role still assigned to users is not deleted
 * either — those users would be left holding a dangling reference and, effectively, no permissions
 * at all. Reassign first.
 */
@Injectable()
export class DeleteRoleUseCase implements UseCase<DeleteRoleCommand, void> {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: DeleteRoleCommand): Promise<void> {
    const roleId = RoleId.from(command.roleId);
    const role = await this.roles.findById(roleId);
    if (!role) {
      throw new RoleNotFoundException();
    }

    role.assertDeletable();

    const inUse = await this.users.countByRole(roleId);
    if (inUse > 0) {
      throw new RoleInUseException(inUse);
    }

    await this.uow.execute(async () => {
      await this.roles.softDelete(roleId);
    });
  }
}
