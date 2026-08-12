import { Module } from '@nestjs/common';
import { SeedDefaultRolesUseCase } from './application/use-cases/seed-default-roles/seed-default-roles.use-case';
import { ListRolesUseCase } from './application/use-cases/list-roles/list-roles.use-case';
import { CreateRoleUseCase } from './application/use-cases/create-role/create-role.use-case';
import { UpdateRoleUseCase } from './application/use-cases/update-role/update-role.use-case';
import { DeleteRoleUseCase } from './application/use-cases/delete-role/delete-role.use-case';
import { RoleAdministrationPolicy } from './application/policies/role-administration.policy';

@Module({
  providers: [
    SeedDefaultRolesUseCase,
    ListRolesUseCase,
    CreateRoleUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
    RoleAdministrationPolicy,
  ],
  // A política é EXPORTADA porque os use cases de usuário também a usam: desabilitar um usuário e
  // trocar o papel dele podem trancar a conta do mesmo jeito que editar um papel. A regra é uma só e
  // vive num lugar só — três cópias divergiriam, e a que divergisse seria a que ninguém testou.
  exports: [
    SeedDefaultRolesUseCase,
    ListRolesUseCase,
    CreateRoleUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
    RoleAdministrationPolicy,
  ],
})
export class RoleModule {}
