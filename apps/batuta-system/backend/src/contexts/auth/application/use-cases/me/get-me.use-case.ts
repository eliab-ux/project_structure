import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountDto } from '../../../../account/application/dto/account.dto';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { AccountNotFoundException } from '../../../../account/domain/exceptions/account-not-found.exception';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { UserDto } from '../../../../user/application/dto/user.dto';
import { UserId } from '../../../../user/domain/value-objects/user-id.vo';
import { UserNotFoundException } from '../../../../user/domain/exceptions/user-not-found.exception';
import { GetMeQuery } from './get-me.query';

export class MeDto {
  user!: UserDto;
  account!: AccountDto;
}

@Injectable()
export class GetMeUseCase implements UseCase<GetMeQuery, MeDto> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
  ) {}

  async execute(query: GetMeQuery): Promise<MeDto> {
    // Tenant-scoped read: a userId from another account resolves to null, not to a foreign user.
    const user = await this.users.findById(UserId.from(query.userId));
    if (!user) {
      throw new UserNotFoundException();
    }

    const account = await this.accounts.findById(AccountId.from(query.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    const dto = new MeDto();
    dto.user = UserDto.fromDomain(user);
    dto.account = AccountDto.fromDomain(account);
    return dto;
  }
}
