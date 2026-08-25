import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult, Pagination, UseCase } from '@gitspread/shared-kernel';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountDto } from '../../../../account/application/dto/account.dto';
import { ListAccountsQuery } from './list-accounts.query';

/** Platform-only listing: this is the one read that legitimately crosses tenants. */
@Injectable()
export class ListAccountsUseCase implements UseCase<
  ListAccountsQuery,
  PaginatedResult<AccountDto>
> {
  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort) {}

  async execute(query: ListAccountsQuery): Promise<PaginatedResult<AccountDto>> {
    const params = Pagination.create(query.page, query.limit);
    const page = await this.accounts.listForPlatform({
      ...params,
      status: query.status,
      search: query.search,
    });

    return { data: page.data.map((account) => AccountDto.fromDomain(account)), meta: page.meta };
  }
}
