import { Module } from '@nestjs/common';
import { ModuleModule } from '../module/module.module';
import { RoleModule } from '../role/role.module';
import { FinanceModule } from '../finance/finance.module';
import { CreateAccountUseCase } from './application/use-cases/create-account/create-account.use-case';
import { GetCurrentAccountUseCase } from './application/use-cases/get-current-account/get-current-account.use-case';
import { UpdateAccountUseCase } from './application/use-cases/update-account/update-account.use-case';
import { UpdateAccountPreferencesUseCase } from './application/use-cases/update-account-preferences/update-account-preferences.use-case';
import { RequestAccountCancellationUseCase } from './application/use-cases/request-account-cancellation/request-account-cancellation.use-case';
import { AccountPreferencesReader } from './application/account-preferences.reader';

/**
 * Repositories come from the @Global RepositoriesModule, so this module only wires use cases.
 * RoleModule is imported for `SeedDefaultRolesUseCase`, which onboarding calls directly.
 *
 * `AccountPreferencesReader` is exported because Contact and Product read the account's preferences
 * (duplicate-document, numbering) when creating/updating records.
 */
@Module({
  imports: [RoleModule, ModuleModule, FinanceModule],
  providers: [
    CreateAccountUseCase,
    GetCurrentAccountUseCase,
    UpdateAccountUseCase,
    UpdateAccountPreferencesUseCase,
    RequestAccountCancellationUseCase,
    AccountPreferencesReader,
  ],
  exports: [
    CreateAccountUseCase,
    GetCurrentAccountUseCase,
    UpdateAccountUseCase,
    UpdateAccountPreferencesUseCase,
    RequestAccountCancellationUseCase,
    AccountPreferencesReader,
  ],
})
export class AccountModule {}
