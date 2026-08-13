import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@veertex/shared-kernel';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../ports/output/account-repository.port';
import { AccountDto } from '../../dto/account.dto';
import { AccountId } from '../../../domain/value-objects/account-id.vo';
import { AccountNotFoundException } from '../../../domain/exceptions/account-not-found.exception';
import {
  PLAN_REPOSITORY,
  PlanRepositoryPort,
} from '../../../../plan/application/ports/output/plan-repository.port';
import { PlanDto } from '../../../../plan/application/dto/plan.dto';

export class GetCurrentAccountQuery {
  constructor(public readonly accountId: string) {}
}

export interface CurrentAccountDto {
  account: AccountDto;
  plan: PlanDto | null;
}

/**
 * The account of the authenticated user, with its plan.
 *
 * The accountId always comes from the token (the controller reads it from `@CurrentUser`), so
 * there is no path here through which a caller names a different tenant.
 */
@Injectable()
export class GetCurrentAccountUseCase implements UseCase<
  GetCurrentAccountQuery,
  CurrentAccountDto
> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort,
  ) {}

  async execute(query: GetCurrentAccountQuery): Promise<CurrentAccountDto> {
    const account = await this.accounts.findById(AccountId.from(query.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    const plan = await this.plans.findById(account.planId);

    return {
      account: AccountDto.fromDomain(account),
      // Null rather than an exception: a plan retired from the catalogue must not stop the account
      // that still holds it from loading its own settings page.
      plan: plan ? PlanDto.fromDomain(plan) : null,
    };
  }
}
