import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { Role } from '../../../domain/entities/role.entity';
import { PermissionSet } from '../../../domain/value-objects/permission-set.vo';
import { DuplicateRoleCodeException } from '../../../domain/exceptions/role-exceptions';
import { ROLE_REPOSITORY, RoleRepositoryPort } from '../../ports/output/role-repository.port';
import { RoleDto } from '../../dto/role.dto';

export class CreateRoleCommand {
  constructor(
    public readonly accountId: string,
    public readonly code: string,
    public readonly name: string,
    public readonly permissions: string[],
    public readonly description?: string | null,
  ) {}
}

@Injectable()
export class CreateRoleUseCase implements UseCase<CreateRoleCommand, RoleDto> {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreateRoleCommand): Promise<RoleDto> {
    const code = command.code.trim().toUpperCase();
    if (await this.roles.findByCode(code)) {
      throw new DuplicateRoleCodeException(code);
    }

    // PermissionSet validates against the catalogue: a permission no guard checks cannot be granted.
    const role = Role.create({
      accountId: command.accountId,
      code,
      name: command.name,
      description: command.description,
      permissions: PermissionSet.create(command.permissions),
      isSystem: false,
    });

    return this.uow.execute(async () => {
      const saved = await this.roles.save(role);
      return RoleDto.fromDomain(saved);
    });
  }
}
