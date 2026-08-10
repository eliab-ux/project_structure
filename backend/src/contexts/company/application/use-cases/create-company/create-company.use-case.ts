import { Inject, Injectable } from '@nestjs/common';
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
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { AccountNotFoundException } from '../../../../account/domain/exceptions/account-not-found.exception';
import {
  PLAN_REPOSITORY,
  PlanRepositoryPort,
} from '../../../../plan/application/ports/output/plan-repository.port';
import { PlanLimitExceededException } from '../../../../plan/domain/exceptions/plan-limit-exceeded.exception';
import { Company } from '../../../domain/entities/company.entity';
import { StateRegistration } from '../../../domain/value-objects/state-registration.vo';
import { TaxRegime } from '../../../domain/value-objects/tax-regime.vo';
import { DuplicateCompanyDocumentException } from '../../../domain/exceptions/company-exceptions';
import {
  COMPANY_REPOSITORY,
  CompanyRepositoryPort,
} from '../../ports/output/company-repository.port';
import { CompanyDto } from '../../dto/company.dto';
import { CreateCompanyCommand } from './create-company.command';

/**
 * Adds a CNPJ to the account, enforcing the plan's ceiling.
 *
 * The ceiling is checked HERE and not in a guard because it is a business rule with a business
 * message ("seu plano permite N empresas"), and because the count it depends on is tenant data —
 * a guard runs before the request transaction that carries the RLS scope and could not read it.
 */
@Injectable()
export class CreateCompanyUseCase implements UseCase<CreateCompanyCommand, CompanyDto> {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreateCompanyCommand): Promise<CompanyDto> {
    const account = await this.accounts.findById(AccountId.from(command.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    const plan = await this.plans.findById(account.planId);
    if (plan) {
      const current = await this.companies.countAll();
      if (plan.limits.wouldExceedCompanies(current)) {
        throw new PlanLimitExceededException('empresas', plan.limits.maxCompanies as number);
      }
    }

    const document = Document.cnpj(command.document);

    // Friendly message for the common case. The unique index is what actually guarantees it —
    // between this SELECT and the INSERT another request can slip through.
    if (await this.companies.findByDocument(document.value)) {
      throw new DuplicateCompanyDocumentException();
    }

    const company = Company.create({
      accountId: command.accountId,
      legalName: command.legalName,
      tradeName: command.tradeName,
      document,
      fiscal: {
        stateRegistration: command.stateRegistration?.replace(/\D/g, '') || null,
        stateRegistrationExempt: command.stateRegistrationExempt,
        municipalRegistration: command.municipalRegistration?.trim() || null,
        suframa: command.suframa?.trim() || null,
        cnae: command.cnae?.replace(/\D/g, '') || null,
        taxRegime: command.taxRegime as TaxRegime,
      },
      address: Address.create(command.address),
      contactEmail: command.contactEmail ? Email.create(command.contactEmail) : null,
      billingEmail: command.billingEmail ? Email.create(command.billingEmail) : null,
      phone: command.phone ? PhoneE164.create(command.phone) : null,
      stateRegistrations: (command.stateRegistrations ?? []).map((registration) =>
        StateRegistration.create(registration.state, registration.registration),
      ),
    });

    return this.uow.execute(async () => {
      const saved = await this.companies.save(company);
      return CompanyDto.fromDomain(saved);
    });
  }
}
