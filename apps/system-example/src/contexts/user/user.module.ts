import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/user-orm.entity';
import { USER_REPOSITORY } from './application/ports/output/user-repository.port';
import { MikroOrmUserRepository } from '../../infrastructure/persistence/mikro-orm/repositories/user.repository';
import { UserMapper } from '../../infrastructure/persistence/mikro-orm/mappers/user.mapper';
import { CreateUserUseCase } from './application/use-cases/create-user/create-user.use-case';
import { GetUserUseCase } from './application/use-cases/get-user/get-user.use-case';

@Module({
  imports: [MikroOrmModule.forFeature([UserOrmEntity])],
  providers: [
    // Mappers
    UserMapper,

    // Repositories (implementing ports)
    {
      provide: USER_REPOSITORY,
      useClass: MikroOrmUserRepository,
    },

    // Use Cases
    CreateUserUseCase,
    GetUserUseCase,
  ],
  exports: [
    // Export use cases for controllers
    CreateUserUseCase,
    GetUserUseCase,
  ],
})
export class UserModule {}
