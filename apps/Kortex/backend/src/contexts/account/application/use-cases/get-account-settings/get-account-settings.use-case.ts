import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../ports/output/account-repository.port';
import { AccountSettingsDto } from '../../dto/account-settings.dto';
import { AccountNotFoundException } from '../../../domain/exceptions/account-not-found.exception';
import { AccountId } from '../../../domain/value-objects/account-id.vo';

export class GetAccountSettingsQuery {
  constructor(public readonly accountId: string) {}
}

@Injectable()
export class GetAccountSettingsUseCase implements UseCase<
  GetAccountSettingsQuery,
  AccountSettingsDto
> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepositoryPort,
  ) {}

  async execute(query: GetAccountSettingsQuery): Promise<AccountSettingsDto> {
    const account = await this.accountRepository.findById(AccountId.from(query.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }
    return AccountSettingsDto.fromDomain(account);
  }
}
