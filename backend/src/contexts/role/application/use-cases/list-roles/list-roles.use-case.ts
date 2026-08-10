import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ROLE_REPOSITORY, RoleRepositoryPort } from '../../ports/output/role-repository.port';
import { RoleDto } from '../../dto/role.dto';

export class ListRolesQuery {}

@Injectable()
export class ListRolesUseCase implements UseCase<ListRolesQuery, RoleDto[]> {
  constructor(@Inject(ROLE_REPOSITORY) private readonly roles: RoleRepositoryPort) {}

  async execute(): Promise<RoleDto[]> {
    const roles = await this.roles.listAll();
    return roles.map((role) => RoleDto.fromDomain(role));
  }
}
