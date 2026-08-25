import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { AccountId } from '../../../domain/value-objects/account-id.vo';
import { AccountNotFoundException } from '../../../domain/exceptions/account-not-found.exception';
import { AccountDto } from '../../dto/account.dto';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../ports/output/account-repository.port';
import { GetCurrentAccountQuery } from './get-current-account.query';

@Injectable()
export class GetCurrentAccountUseCase implements UseCase<GetCurrentAccountQuery, AccountDto> {
  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort) {}

  async execute(query: GetCurrentAccountQuery): Promise<AccountDto> {
    const account = await this.accounts.findById(AccountId.from(query.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }
    return AccountDto.fromDomain(account);
  }
}
