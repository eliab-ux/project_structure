import { Module } from '@nestjs/common';
import { RoleModule } from '../role/role.module';
import { CreateUserUseCase } from './application/use-cases/create-user/create-user.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users/list-users.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user/update-user.use-case';
import { SetUserStatusUseCase } from './application/use-cases/set-user-status/set-user-status.use-case';

@Module({
  // `RoleModule` pela `RoleAdministrationPolicy`: desabilitar um usuário e trocar o papel dele podem
  // deixar a conta sem ninguém capaz de administrar papéis, e a regra que decide isso é a mesma que
  // vale ao editar um papel. Vive no contexto de role, que é o dono da noção de permissão.
  imports: [RoleModule],
  providers: [CreateUserUseCase, ListUsersUseCase, UpdateUserUseCase, SetUserStatusUseCase],
  exports: [CreateUserUseCase, ListUsersUseCase, UpdateUserUseCase, SetUserStatusUseCase],
})
export class UserModule {}
