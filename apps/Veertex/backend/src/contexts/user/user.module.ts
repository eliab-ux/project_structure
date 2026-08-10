import { Module } from '@nestjs/common';
import { CreateUserUseCase } from './application/use-cases/create-user/create-user.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users/list-users.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user/update-user.use-case';
import { SetUserStatusUseCase } from './application/use-cases/set-user-status/set-user-status.use-case';

@Module({
  providers: [CreateUserUseCase, ListUsersUseCase, UpdateUserUseCase, SetUserStatusUseCase],
  exports: [CreateUserUseCase, ListUsersUseCase, UpdateUserUseCase, SetUserStatusUseCase],
})
export class UserModule {}
