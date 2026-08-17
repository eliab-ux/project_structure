import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/user-orm.entity';
import { UserPhoneChangeAuditOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/user-phone-change-audit-orm.entity';
import { UserMapper } from '../../infrastructure/persistence/mikro-orm/mappers/user.mapper';
import { PhoneChangeAuditMapper } from '../../infrastructure/persistence/mikro-orm/mappers/phone-change-audit.mapper';
import { MikroOrmUserRepository } from '../../infrastructure/persistence/mikro-orm/repositories/mikro-orm-user.repository';
import { MikroOrmPhoneChangeAuditRepository } from '../../infrastructure/persistence/mikro-orm/repositories/mikro-orm-phone-change-audit.repository';
import { SecurityModule } from '../../infrastructure/security/security.module';
import { USER_REPOSITORY } from './application/ports/output/user-repository.port';
import { PHONE_CHANGE_AUDIT_REPOSITORY } from './application/ports/output/phone-change-audit-repository.port';
import { ListUsersUseCase } from './application/use-cases/list-users/list-users.use-case';
import { CreateUserUseCase } from './application/use-cases/create-user/create-user.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user/update-user.use-case';
import { SetUserActiveUseCase } from './application/use-cases/set-user-active/set-user-active.use-case';
import { ChangeOwnPhoneUseCase } from './application/use-cases/change-own-phone/change-own-phone.use-case';

@Module({
  // SecurityModule fornece PASSWORD_HASHER (bcrypt) e TOKEN_SERVICE.
  imports: [
    MikroOrmModule.forFeature([UserOrmEntity, UserPhoneChangeAuditOrmEntity]),
    SecurityModule,
  ],
  providers: [
    UserMapper,
    PhoneChangeAuditMapper,
    { provide: USER_REPOSITORY, useClass: MikroOrmUserRepository },
    { provide: PHONE_CHANGE_AUDIT_REPOSITORY, useClass: MikroOrmPhoneChangeAuditRepository },
    ListUsersUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    SetUserActiveUseCase,
    ChangeOwnPhoneUseCase,
  ],
  exports: [
    ListUsersUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    SetUserActiveUseCase,
    ChangeOwnPhoneUseCase,
    // O contexto auth precisa do repositório para autenticar, e o script de bootstrap para criar
    // o primeiro dono.
    USER_REPOSITORY,
  ],
})
export class UserModule {}
