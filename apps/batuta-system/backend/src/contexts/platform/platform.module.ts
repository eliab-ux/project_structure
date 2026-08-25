import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PLATFORM_ADMIN_REPOSITORY } from './application/ports/output/platform-admin-repository.port';
import { ACCOUNT_ABUSE_SIGNAL_REPOSITORY } from './application/ports/output/account-abuse-signal-repository.port';
import { PlatformLoginUseCase } from './application/use-cases/platform-login/platform-login.use-case';
import { CreateAccountUseCase } from './application/use-cases/create-account/create-account.use-case';
import { ListAccountsUseCase } from './application/use-cases/list-accounts/list-accounts.use-case';
import { SuspendAccountUseCase } from './application/use-cases/suspend-account/suspend-account.use-case';
import { ReactivateAccountUseCase } from './application/use-cases/reactivate-account/reactivate-account.use-case';
import { ChangeDailyCeilingUseCase } from './application/use-cases/change-daily-ceiling/change-daily-ceiling.use-case';
import { AssignEvolutionServerUseCase } from './application/use-cases/assign-evolution-server/assign-evolution-server.use-case';
import { GetAbuseSignalsUseCase } from './application/use-cases/get-abuse-signals/get-abuse-signals.use-case';
import { AccountModule } from '../account/account.module';
import { UserModule } from '../user/user.module';
import { PlatformAdminOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/platform-admin-orm.entity';
import { AccountAbuseSignalOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/account-abuse-signal-orm.entity';
import { PlatformAdminMapper } from '../../infrastructure/persistence/mikro-orm/mappers/platform-admin.mapper';
import { MikroOrmPlatformAdminRepository } from '../../infrastructure/persistence/mikro-orm/repositories/platform-admin.repository';
import { MikroOrmAccountAbuseSignalRepository } from '../../infrastructure/persistence/mikro-orm/repositories/account-abuse-signal.repository';

@Module({
  imports: [
    MikroOrmModule.forFeature([PlatformAdminOrmEntity, AccountAbuseSignalOrmEntity]),
    AccountModule,
    UserModule,
  ],
  providers: [
    PlatformAdminMapper,
    { provide: PLATFORM_ADMIN_REPOSITORY, useClass: MikroOrmPlatformAdminRepository },
    { provide: ACCOUNT_ABUSE_SIGNAL_REPOSITORY, useClass: MikroOrmAccountAbuseSignalRepository },
    PlatformLoginUseCase,
    CreateAccountUseCase,
    ListAccountsUseCase,
    SuspendAccountUseCase,
    ReactivateAccountUseCase,
    ChangeDailyCeilingUseCase,
    AssignEvolutionServerUseCase,
    GetAbuseSignalsUseCase,
  ],
  exports: [
    PlatformLoginUseCase,
    CreateAccountUseCase,
    ListAccountsUseCase,
    SuspendAccountUseCase,
    ReactivateAccountUseCase,
    ChangeDailyCeilingUseCase,
    AssignEvolutionServerUseCase,
    GetAbuseSignalsUseCase,
  ],
})
export class PlatformModule {}
