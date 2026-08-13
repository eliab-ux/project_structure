import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@veertex/shared-kernel';
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

export class RequestAccountCancellationCommand {
  constructor(
    public readonly accountId: string,
    public readonly requestedByUserId: string,
    /** `false` withdraws a pending request. */
    public readonly requested: boolean,
  ) {}
}

/**
 * Step one of "nunca prender dados do cliente" (Visão Geral §2.5): the account records that
 * cancellation was asked for and KEEPS WORKING, so the customer can export everything first.
 *
 * Nothing is deleted or disabled here, and no timer in the domain finishes the job — confirming the
 * cancellation is a separate operator action. A request that silently became a deletion after N
 * days is exactly the trap this two-step design exists to avoid.
 */
@Injectable()
export class RequestAccountCancellationUseCase implements UseCase<
  RequestAccountCancellationCommand,
  AccountDto
> {
  private readonly logger = new Logger(RequestAccountCancellationUseCase.name);

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: RequestAccountCancellationCommand): Promise<AccountDto> {
    const account = await this.accounts.findById(AccountId.from(command.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    if (command.requested) {
      account.requestCancellation();
    } else {
      account.withdrawCancellation();
    }

    return this.uow.execute(async () => {
      const saved = await this.accounts.save(account);
      this.logger.warn('Cancelamento de conta atualizado', {
        accountId: saved.id.value,
        requestedByUserId: command.requestedByUserId,
        requested: command.requested,
      });
      return AccountDto.fromDomain(saved);
    });
  }
}
