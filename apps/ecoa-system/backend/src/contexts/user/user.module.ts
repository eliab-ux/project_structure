import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/user-orm.entity';
import { UserMapper } from '../../infrastructure/persistence/mikro-orm/mappers/user.mapper';
import { MikroOrmUserRepository } from '../../infrastructure/persistence/mikro-orm/repositories/user.repository';
import { USER_REPOSITORY } from './application/ports/output/user-repository.port';
import { RegisterUserUseCase } from './application/use-cases/register-user/register-user.use-case';
import { GetMeUseCase } from './application/use-cases/get-me/get-me.use-case';

@Module({
  imports: [MikroOrmModule.forFeature([UserOrmEntity])],
  providers: [
    UserMapper,
    { provide: USER_REPOSITORY, useClass: MikroOrmUserRepository },
    RegisterUserUseCase,
    GetMeUseCase,
  ],
  exports: [USER_REPOSITORY, RegisterUserUseCase, GetMeUseCase],
})
export class UserModule {}
