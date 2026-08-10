import { Module } from '@nestjs/common';
import { SeedDefaultRolesUseCase } from './application/use-cases/seed-default-roles/seed-default-roles.use-case';
import { ListRolesUseCase } from './application/use-cases/list-roles/list-roles.use-case';
import { CreateRoleUseCase } from './application/use-cases/create-role/create-role.use-case';
import { UpdateRoleUseCase } from './application/use-cases/update-role/update-role.use-case';
import { DeleteRoleUseCase } from './application/use-cases/delete-role/delete-role.use-case';

@Module({
  providers: [
    SeedDefaultRolesUseCase,
    ListRolesUseCase,
    CreateRoleUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
  ],
  exports: [
    SeedDefaultRolesUseCase,
    ListRolesUseCase,
    CreateRoleUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
  ],
})
export class RoleModule {}
