import { Module } from '@nestjs/common';
import { CreateCompanyUseCase } from './application/use-cases/create-company/create-company.use-case';
import { UpdateCompanyUseCase } from './application/use-cases/update-company/update-company.use-case';
import { ListCompaniesUseCase } from './application/use-cases/list-companies/list-companies.use-case';
import { GetCompanyUseCase } from './application/use-cases/get-company/get-company.use-case';
import { SetCompanyStatusUseCase } from './application/use-cases/set-company-status/set-company-status.use-case';

@Module({
  providers: [
    CreateCompanyUseCase,
    UpdateCompanyUseCase,
    ListCompaniesUseCase,
    GetCompanyUseCase,
    SetCompanyStatusUseCase,
  ],
  exports: [
    CreateCompanyUseCase,
    UpdateCompanyUseCase,
    ListCompaniesUseCase,
    GetCompanyUseCase,
    SetCompanyStatusUseCase,
  ],
})
export class CompanyModule {}
