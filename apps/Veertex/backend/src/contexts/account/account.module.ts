import { Module } from '@nestjs/common';
import { ModuleModule } from '../module/module.module';
import { RoleModule } from '../role/role.module';
import { CreateAccountUseCase } from './application/use-cases/create-account/create-account.use-case';
import { GetCurrentAccountUseCase } from './application/use-cases/get-current-account/get-current-account.use-case';
import { UpdateAccountUseCase } from './application/use-cases/update-account/update-account.use-case';
import { RequestAccountCancellationUseCase } from './application/use-cases/request-account-cancellation/request-account-cancellation.use-case';

/**
 * Repositories come from the @Global RepositoriesModule, so this module only wires use cases.
 * RoleModule is imported for `SeedDefaultRolesUseCase`, which onboarding calls directly.
 */
@Module({
  imports: [RoleModule, ModuleModule],
  providers: [
    CreateAccountUseCase,
    GetCurrentAccountUseCase,
    UpdateAccountUseCase,
    RequestAccountCancellationUseCase,
  ],
  exports: [
    CreateAccountUseCase,
    GetCurrentAccountUseCase,
    UpdateAccountUseCase,
    RequestAccountCancellationUseCase,
  ],
})
export class AccountModule {}
