import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../ports/output/account-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { AccountDto } from '../../dto/account.dto';
import { AccountId } from '../../../domain/value-objects/account-id.vo';
import { AccountNotFoundException } from '../../../domain/exceptions/account-not-found.exception';

export class UpdateAccountCommand {
  constructor(
    public readonly accountId: string,
    public readonly name?: string,
    public readonly timezone?: string,
  ) {}
}

/**
 * Edits the account's own settings. Deliberately narrow: `plan`, `status` and `document` are not
 * editable here. A tenant changing its own plan or lifting its own suspension would be an
 * authorization hole no permission string can fix — those belong to the operator path.
 */
@Injectable()
export class UpdateAccountUseCase implements UseCase<UpdateAccountCommand, AccountDto> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateAccountCommand): Promise<AccountDto> {
    const account = await this.accounts.findById(AccountId.from(command.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    if (command.name !== undefined) {
      account.rename(command.name);
    }
    if (command.timezone !== undefined) {
      account.changeTimezone(command.timezone);
    }

    return this.uow.execute(async () => {
      const saved = await this.accounts.save(account);
      return AccountDto.fromDomain(saved);
    });
  }
}
