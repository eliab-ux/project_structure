import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { CompanyId } from '../../../domain/value-objects/company-id.vo';
import { CompanyNotFoundException } from '../../../domain/exceptions/company-exceptions';
import {
  COMPANY_REPOSITORY,
  CompanyRepositoryPort,
} from '../../ports/output/company-repository.port';
import { CompanyDto } from '../../dto/company.dto';

export class GetCompanyQuery {
  constructor(public readonly companyId: string) {}
}

@Injectable()
export class GetCompanyUseCase implements UseCase<GetCompanyQuery, CompanyDto> {
  constructor(@Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepositoryPort) {}

  async execute(query: GetCompanyQuery): Promise<CompanyDto> {
    const company = await this.companies.findById(CompanyId.from(query.companyId));
    if (!company) {
      // Also the answer for a company that exists in another account: RLS makes "forbidden" and
      // "absent" indistinguishable here, which is the safer of the two.
      throw new CompanyNotFoundException();
    }
    return CompanyDto.fromDomain(company);
  }
}
