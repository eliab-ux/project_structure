import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

import { PLAN_REPOSITORY } from '../../contexts/plan/application/ports/output/plan-repository.port';
import { ACCOUNT_REPOSITORY } from '../../contexts/account/application/ports/output/account-repository.port';
import { COMPANY_REPOSITORY } from '../../contexts/company/application/ports/output/company-repository.port';
import { ROLE_REPOSITORY } from '../../contexts/role/application/ports/output/role-repository.port';
import { USER_REPOSITORY } from '../../contexts/user/application/ports/output/user-repository.port';
import { PASSWORD_RESET_CODE_REPOSITORY } from '../../contexts/auth/application/ports/output/password-reset-code-repository.port';
import { ACCOUNT_MODULE_REPOSITORY } from '../../contexts/module/application/ports/output/account-module-repository.port';

import { PlanOrmEntity } from './mikro-orm/entities/plan-orm.entity';
import { AccountOrmEntity } from './mikro-orm/entities/account-orm.entity';
import { CompanyOrmEntity } from './mikro-orm/entities/company-orm.entity';
import { RoleOrmEntity } from './mikro-orm/entities/role-orm.entity';
import { UserOrmEntity } from './mikro-orm/entities/user-orm.entity';
import { PasswordResetCodeOrmEntity } from './mikro-orm/entities/password-reset-code-orm.entity';
import { ModuleOrmEntity } from './mikro-orm/entities/module-orm.entity';
import { AccountModuleOrmEntity } from './mikro-orm/entities/account-module-orm.entity';

import { PlanMapper } from './mikro-orm/mappers/plan.mapper';
import { AccountMapper } from './mikro-orm/mappers/account.mapper';
import { CompanyMapper } from './mikro-orm/mappers/company.mapper';
import { RoleMapper } from './mikro-orm/mappers/role.mapper';
import { UserMapper } from './mikro-orm/mappers/user.mapper';

import { MikroOrmPlanRepository } from './mikro-orm/repositories/plan.repository';
import { MikroOrmAccountRepository } from './mikro-orm/repositories/account.repository';
import { MikroOrmCompanyRepository } from './mikro-orm/repositories/company.repository';
import { MikroOrmRoleRepository } from './mikro-orm/repositories/role.repository';
import { MikroOrmUserRepository } from './mikro-orm/repositories/user.repository';
import { MikroOrmPasswordResetCodeRepository } from './mikro-orm/repositories/password-reset-code.repository';
import { MikroOrmAccountModuleRepository } from './mikro-orm/repositories/account-module.repository';

/**
 * Every repository, in one @Global module.
 *
 * The alternative — each context module providing its own — reads tidier on paper and produces
 * circular imports in practice: deleting a role has to count the users holding it, creating a user
 * has to read the role, and onboarding touches four contexts at once. Those are real relationships,
 * not accidents of layering, and `forwardRef` chains would be the cost of pretending otherwise.
 *
 * What matters for the architecture is preserved: use cases still depend on the PORT symbols and
 * never on a concrete repository, so nothing here leaks into the application layer.
 */
@Global()
@Module({
  imports: [
    MikroOrmModule.forFeature([
      PlanOrmEntity,
      AccountOrmEntity,
      CompanyOrmEntity,
      RoleOrmEntity,
      UserOrmEntity,
      PasswordResetCodeOrmEntity,
      ModuleOrmEntity,
      AccountModuleOrmEntity,
    ]),
  ],
  providers: [
    PlanMapper,
    AccountMapper,
    CompanyMapper,
    RoleMapper,
    UserMapper,
    { provide: PLAN_REPOSITORY, useClass: MikroOrmPlanRepository },
    { provide: ACCOUNT_REPOSITORY, useClass: MikroOrmAccountRepository },
    { provide: COMPANY_REPOSITORY, useClass: MikroOrmCompanyRepository },
    { provide: ROLE_REPOSITORY, useClass: MikroOrmRoleRepository },
    { provide: USER_REPOSITORY, useClass: MikroOrmUserRepository },
    {
      provide: PASSWORD_RESET_CODE_REPOSITORY,
      useClass: MikroOrmPasswordResetCodeRepository,
    },
    { provide: ACCOUNT_MODULE_REPOSITORY, useClass: MikroOrmAccountModuleRepository },
  ],
  exports: [
    PLAN_REPOSITORY,
    ACCOUNT_REPOSITORY,
    COMPANY_REPOSITORY,
    ROLE_REPOSITORY,
    USER_REPOSITORY,
    PASSWORD_RESET_CODE_REPOSITORY,
    ACCOUNT_MODULE_REPOSITORY,
  ],
})
export class RepositoriesModule {}
