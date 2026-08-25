import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { USER_REPOSITORY } from './application/ports/output/user-repository.port';
import { CreateUserUseCase } from './application/use-cases/create-user/create-user.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users/list-users.use-case';
import { ChangeUserRoleUseCase } from './application/use-cases/change-user-role/change-user-role.use-case';
import { ChangeUserPhoneUseCase } from './application/use-cases/change-user-phone/change-user-phone.use-case';
import { DisableUserUseCase } from './application/use-cases/disable-user/disable-user.use-case';
import { UserOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/user-orm.entity';
import { UserMapper } from '../../infrastructure/persistence/mikro-orm/mappers/user.mapper';
import { MikroOrmUserRepository } from '../../infrastructure/persistence/mikro-orm/repositories/user.repository';

@Module({
  imports: [MikroOrmModule.forFeature([UserOrmEntity])],
  providers: [
    UserMapper,
    { provide: USER_REPOSITORY, useClass: MikroOrmUserRepository },
    CreateUserUseCase,
    ListUsersUseCase,
    ChangeUserRoleUseCase,
    ChangeUserPhoneUseCase,
    DisableUserUseCase,
  ],
  exports: [
    USER_REPOSITORY,
    CreateUserUseCase,
    ListUsersUseCase,
    ChangeUserRoleUseCase,
    ChangeUserPhoneUseCase,
    DisableUserUseCase,
  ],
})
export class UserModule {}
