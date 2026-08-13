import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@veertex/shared-kernel';
import {
  COMPANY_REPOSITORY,
  CompanyRepositoryPort,
} from '../../ports/output/company-repository.port';
import { CompanyDto } from '../../dto/company.dto';

export class ListCompaniesQuery {
  constructor(public readonly includeInactive: boolean = false) {}
}

/**
 * Every company of the account. Not paginated on purpose: an account has a handful of CNPJs, and
 * this list feeds the company selector that every screen needs (Visão Geral §3 — "empresa é
 * dimensão analítica obrigatória"). Paginating it would make the selector need a second call.
 */
@Injectable()
export class ListCompaniesUseCase implements UseCase<ListCompaniesQuery, CompanyDto[]> {
  constructor(@Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepositoryPort) {}

  async execute(query: ListCompaniesQuery): Promise<CompanyDto[]> {
    const companies = await this.companies.listAll();
    return companies
      .filter((company) => query.includeInactive || company.active)
      .map((company) => CompanyDto.fromDomain(company));
  }
}
