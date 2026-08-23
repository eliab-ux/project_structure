import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  FINANCIAL_ACCOUNT_REPOSITORY,
  FinancialAccountRepositoryPort,
} from '../../ports/output/financial-account-repository.port';
import { FinancialAccountDto } from '../../dto/finance.dto';

export class ListFinancialAccountsQuery {
  constructor(public readonly includeInactive: boolean = false) {}
}

/** Lista as contas financeiras da conta (§2.3 do 05). */
@Injectable()
export class ListFinancialAccountsUseCase implements UseCase<
  ListFinancialAccountsQuery,
  FinancialAccountDto[]
> {
  constructor(
    @Inject(FINANCIAL_ACCOUNT_REPOSITORY)
    private readonly accounts: FinancialAccountRepositoryPort,
  ) {}

  async execute(query: ListFinancialAccountsQuery): Promise<FinancialAccountDto[]> {
    const accounts = await this.accounts.list(query.includeInactive);
    return accounts.map(FinancialAccountDto.fromDomain);
  }
}
