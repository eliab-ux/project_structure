import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { Address } from '../../../../../shared/domain/value-objects/address.vo';
import { Document } from '../../../../../shared/domain/value-objects/document.vo';
import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../auth/application/ports/output/password-hasher.port';
import { assertPasswordStrength } from '../../../../auth/domain/password-policy';
import {
  COMPANY_REPOSITORY,
  CompanyRepositoryPort,
} from '../../../../company/application/ports/output/company-repository.port';
import { Company } from '../../../../company/domain/entities/company.entity';
import { StateRegistration } from '../../../../company/domain/value-objects/state-registration.vo';
import { TaxRegime } from '../../../../company/domain/value-objects/tax-regime.vo';
import {
  PLAN_REPOSITORY,
  PlanRepositoryPort,
} from '../../../../plan/application/ports/output/plan-repository.port';
import { PlanNotFoundException } from '../../../../plan/domain/exceptions/plan-not-found.exception';
import {
  ROLE_REPOSITORY,
  RoleRepositoryPort,
} from '../../../../role/application/ports/output/role-repository.port';
import { ADMIN_ROLE_CODE } from '../../../../role/domain/default-roles';
import { SeedDefaultRolesUseCase } from '../../../../role/application/use-cases/seed-default-roles/seed-default-roles.use-case';
import { SeedAccountModulesUseCase } from '../../../../module/application/use-cases/seed-account-modules/seed-account-modules.use-case';
import {
  ACCOUNT_MODULE_REPOSITORY,
  AccountModuleRepositoryPort,
} from '../../../../module/application/ports/output/account-module-repository.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { User } from '../../../../user/domain/entities/user.entity';
import {
  STOCK_LOCATION_REPOSITORY,
  StockLocationRepositoryPort,
} from '../../../../stock/application/ports/output/stock-location-repository.port';
import {
  DEFAULT_WAREHOUSE_NAME,
  StockLocation,
} from '../../../../stock/domain/entities/stock-location.entity';
import {
  FINANCIAL_CATEGORY_REPOSITORY,
  FinancialCategoryRepositoryPort,
} from '../../../../finance/application/ports/output/financial-category-repository.port';
import { SeedFinancialCategoriesUseCase } from '../../../../finance/application/use-cases/seed-financial-categories/seed-financial-categories.use-case';
import { Account } from '../../../domain/entities/account.entity';
import { AccountDto } from '../../dto/account.dto';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../ports/output/account-repository.port';
import { CreateAccountCommand } from './create-account.command';

export interface CreateAccountResult {
  account: AccountDto;
  companyId: string;
  adminUserId: string;
}

/**
 * Onboarding: creates the tenant, its first company, its seven default roles and the admin user —
 * all in ONE transaction.
 *
 * Atomicity is the whole point. Half an onboarding is an account nobody can log into, or a user
 * with no role, and neither state has a repair path inside the product. If any step fails, nothing
 * is written.
 *
 * **Runs under the OPERATOR scope, not a tenant scope**, and that is why it is reachable only from
 * the `create:account` CLI (which connects as `veertex_owner`) and not from an HTTP route. Every
 * insert here is for a tenant that does not exist yet, so there is no scope to establish and RLS
 * would reject the writes under the runtime role. Making this an endpoint would require punching a
 * hole in exactly the isolation F1 exists to build — when self-service signup arrives it gets its
 * own deliberate path, not this one.
 *
 * This use case deliberately reaches across contexts (company, role, user). Onboarding is by nature
 * the one operation that spans them; the alternative — four independent calls — is precisely the
 * non-atomic version being avoided.
 */
@Injectable()
export class CreateAccountUseCase implements UseCase<CreateAccountCommand, CreateAccountResult> {
  private readonly logger = new Logger(CreateAccountUseCase.name);

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepositoryPort,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(STOCK_LOCATION_REPOSITORY) private readonly stockLocations: StockLocationRepositoryPort,
    @Inject(FINANCIAL_CATEGORY_REPOSITORY)
    private readonly financialCategories: FinancialCategoryRepositoryPort,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(ACCOUNT_MODULE_REPOSITORY)
    private readonly accountModules: AccountModuleRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    private readonly seedDefaultRoles: SeedDefaultRolesUseCase,
    private readonly seedAccountModules: SeedAccountModulesUseCase,
    private readonly seedFinancialCategories: SeedFinancialCategoriesUseCase,
  ) {}

  async execute(command: CreateAccountCommand): Promise<CreateAccountResult> {
    assertPasswordStrength(command.adminPassword);

    const plan = await this.plans.findByCode(command.planCode);
    if (!plan) {
      throw new PlanNotFoundException(command.planCode);
    }

    const accountDocument = Document.create(command.accountDocument);
    const companyDocument = Document.cnpj(command.companyDocument);
    const adminEmail = Email.create(command.adminEmail);
    // CLAUDE.md regra 9: the very first user of the account already needs a WhatsApp, or the
    // account is one forgotten password away from needing database access to recover.
    const adminPhone = PhoneE164.create(command.adminPhone);

    const account = Account.create({
      name: command.accountName,
      document: accountDocument,
      planId: plan.id,
      planCode: plan.code,
      timezone: command.timezone,
    });

    const company = Company.create({
      accountId: account.id.value,
      legalName: command.companyLegalName,
      tradeName: command.companyTradeName,
      document: companyDocument,
      fiscal: {
        stateRegistration: command.companyStateRegistration?.replace(/\D/g, '') || null,
        stateRegistrationExempt: command.companyStateRegistrationExempt,
        municipalRegistration: null,
        suframa: null,
        cnae: null,
        taxRegime: command.companyTaxRegime as TaxRegime,
      },
      address: Address.create(command.companyAddress),
      contactEmail: adminEmail,
      stateRegistrations: [] as StateRegistration[],
    });

    const roles = this.seedDefaultRoles.build(account.id.value);
    const adminRole = roles.find((role) => role.code === ADMIN_ROLE_CODE);
    if (!adminRole) {
      // Unreachable unless DEFAULT_ROLES is edited badly — loud rather than a user with no role.
      throw new Error(`Papel ${ADMIN_ROLE_CODE} ausente em DEFAULT_ROLES.`);
    }

    const admin = User.create({
      accountId: account.id.value,
      name: command.adminName,
      email: adminEmail,
      phone: adminPhone,
      passwordHash: await this.hasher.hash(command.adminPassword),
      roleId: adminRole.id.value,
    });

    // Todo módulo que o plano permite já nasce ligado — o toggle existe para DESLIGAR o que a conta
    // não usa, não para montar o produto peça por peça (critério §7.1: operável em menos de 5 min).
    const accountModules = this.seedAccountModules.build({
      accountId: account.id.value,
      planModules: plan.limits.modules,
    });

    // Árvore inicial de categorias financeiras (§2.4 do 05) — a conta começa operável no FIN.
    const financialCategories = this.seedFinancialCategories.build(account.id.value);

    return this.uow.execute(async () => {
      const savedAccount = await this.accounts.save(account);
      await this.roles.saveAll(roles);
      await this.accountModules.saveAll(accountModules);
      await this.financialCategories.saveAll(financialCategories);
      const savedCompany = await this.companies.save(company);
      // Depósito default da primeira empresa (§2 do 03A) — parte do onboarding atômico.
      await this.stockLocations.save(
        StockLocation.create({
          accountId: account.id.value,
          companyId: savedCompany.id.value,
          kind: 'warehouse',
          name: DEFAULT_WAREHOUSE_NAME,
        }),
      );
      const savedAdmin = await this.users.save(admin);

      this.logger.log('Conta criada', {
        accountId: savedAccount.id.value,
        planCode: plan.code,
        companyId: savedCompany.id.value,
        adminUserId: savedAdmin.id.value,
      });

      return {
        account: AccountDto.fromDomain(savedAccount),
        companyId: savedCompany.id.value,
        adminUserId: savedAdmin.id.value,
      };
    });
  }
}
