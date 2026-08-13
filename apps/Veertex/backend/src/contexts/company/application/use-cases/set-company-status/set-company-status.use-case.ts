import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@veertex/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { CompanyId } from '../../../domain/value-objects/company-id.vo';
import {
  CompanyNotFoundException,
  LastActiveCompanyException,
} from '../../../domain/exceptions/company-exceptions';
import {
  COMPANY_REPOSITORY,
  CompanyRepositoryPort,
} from '../../ports/output/company-repository.port';
import { CompanyDto } from '../../dto/company.dto';

export class SetCompanyStatusCommand {
  constructor(
    public readonly companyId: string,
    public readonly active: boolean,
  ) {}
}

/**
 * Activates or deactivates a company. There is no delete: fiscal documents reference the company
 * for years, so the row has to stay readable.
 */
@Injectable()
export class SetCompanyStatusUseCase implements UseCase<SetCompanyStatusCommand, CompanyDto> {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: SetCompanyStatusCommand): Promise<CompanyDto> {
    const company = await this.companies.findById(CompanyId.from(command.companyId));
    if (!company) {
      throw new CompanyNotFoundException();
    }

    if (!command.active) {
      // An account with no active company cannot sell, invoice or move stock — every one of those
      // needs one. Better a clear refusal now than a broken account discovered at the first order.
      const activeCount = await this.companies.countActive();
      if (company.active && activeCount <= 1) {
        throw new LastActiveCompanyException();
      }
      company.deactivate();
    } else {
      company.activate();
    }

    return this.uow.execute(async () => {
      const saved = await this.companies.save(company);
      return CompanyDto.fromDomain(saved);
    });
  }
}
