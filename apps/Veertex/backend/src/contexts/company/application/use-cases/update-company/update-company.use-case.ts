import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { Address } from '../../../../../shared/domain/value-objects/address.vo';
import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { CompanyId } from '../../../domain/value-objects/company-id.vo';
import { StateRegistration } from '../../../domain/value-objects/state-registration.vo';
import { TaxRegime } from '../../../domain/value-objects/tax-regime.vo';
import { CompanyNotFoundException } from '../../../domain/exceptions/company-exceptions';
import {
  COMPANY_REPOSITORY,
  CompanyRepositoryPort,
} from '../../ports/output/company-repository.port';
import { CompanyDto } from '../../dto/company.dto';
import {
  CreateCompanyAddressInput,
  CreateCompanyStateRegistrationInput,
} from '../create-company/create-company.command';

/**
 * Everything except the CNPJ. Changing a company's CNPJ is not an edit — it is a different company,
 * with different fiscal numbering and a different invoice history, so the operation does not exist.
 */
export class UpdateCompanyCommand {
  constructor(
    public readonly companyId: string,
    public readonly legalName?: string,
    public readonly tradeName?: string | null,
    public readonly taxRegime?: string,
    public readonly stateRegistration?: string | null,
    public readonly stateRegistrationExempt?: boolean,
    public readonly municipalRegistration?: string | null,
    public readonly suframa?: string | null,
    public readonly cnae?: string | null,
    public readonly address?: CreateCompanyAddressInput,
    public readonly contactEmail?: string | null,
    public readonly billingEmail?: string | null,
    public readonly phone?: string | null,
    public readonly stateRegistrations?: CreateCompanyStateRegistrationInput[],
  ) {}
}

@Injectable()
export class UpdateCompanyUseCase implements UseCase<UpdateCompanyCommand, CompanyDto> {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateCompanyCommand): Promise<CompanyDto> {
    // Scoped by RLS + tenant filter: a company id from another account simply does not resolve.
    const company = await this.companies.findById(CompanyId.from(command.companyId));
    if (!company) {
      throw new CompanyNotFoundException();
    }

    company.updateIdentification({
      legalName: command.legalName,
      tradeName: command.tradeName,
    });

    // The fiscal block is validated as a WHOLE (exempt vs. registration), so a partial update has
    // to be merged onto the current values before the entity checks consistency.
    const fiscalTouched =
      command.taxRegime !== undefined ||
      command.stateRegistration !== undefined ||
      command.stateRegistrationExempt !== undefined ||
      command.municipalRegistration !== undefined ||
      command.suframa !== undefined ||
      command.cnae !== undefined;

    if (fiscalTouched) {
      const current = company.fiscal;
      company.changeFiscalData({
        taxRegime: (command.taxRegime as TaxRegime) ?? current.taxRegime,
        stateRegistration:
          command.stateRegistration !== undefined
            ? command.stateRegistration?.replace(/\D/g, '') || null
            : current.stateRegistration,
        stateRegistrationExempt: command.stateRegistrationExempt ?? current.stateRegistrationExempt,
        municipalRegistration:
          command.municipalRegistration !== undefined
            ? command.municipalRegistration?.trim() || null
            : current.municipalRegistration,
        suframa: command.suframa !== undefined ? command.suframa?.trim() || null : current.suframa,
        cnae: command.cnae !== undefined ? command.cnae?.replace(/\D/g, '') || null : current.cnae,
      });
    }

    if (command.address) {
      company.changeAddress(Address.create(command.address));
    }

    company.changeContacts({
      contactEmail:
        command.contactEmail !== undefined
          ? command.contactEmail
            ? Email.create(command.contactEmail)
            : null
          : undefined,
      billingEmail:
        command.billingEmail !== undefined
          ? command.billingEmail
            ? Email.create(command.billingEmail)
            : null
          : undefined,
      phone:
        command.phone !== undefined
          ? command.phone
            ? PhoneE164.create(command.phone)
            : null
          : undefined,
    });

    if (command.stateRegistrations) {
      company.replaceStateRegistrations(
        command.stateRegistrations.map((registration) =>
          StateRegistration.create(registration.state, registration.registration),
        ),
      );
    }

    return this.uow.execute(async () => {
      const saved = await this.companies.save(company);
      return CompanyDto.fromDomain(saved);
    });
  }
}
