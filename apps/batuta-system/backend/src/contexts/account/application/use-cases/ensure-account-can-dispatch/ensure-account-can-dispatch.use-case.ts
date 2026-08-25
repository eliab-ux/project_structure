import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { AccountId } from '../../../domain/value-objects/account-id.vo';
import { AccountNotFoundException } from '../../../domain/exceptions/account-not-found.exception';
import { AccountSuspendedException } from '../../../domain/exceptions/account-suspended.exception';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../ports/output/account-repository.port';
import { DAILY_SEND_USAGE, DailySendUsagePort } from '../../ports/output/daily-send-usage.port';
import { EnsureAccountCanDispatchCommand } from './ensure-account-can-dispatch.command';

export class DispatchAllowanceDto {
  accountId!: string;
  /** How many more messages the account may send today, after the account-wide ceiling. */
  remainingToday!: number;
  dailySendCeiling!: number;
  alreadySentToday!: number;
}

/**
 * The gate every dispatch path goes through. Two rules, both hard:
 *
 *  1. a SUSPENDED account never sends — the worker refuses (§5, FASE 1 item 6);
 *  2. `accounts.daily_send_ceiling` PREVAILS over the sum of channel quotas (§9.2). A plan that
 *     does not fit raises, so the caller reports the excess. It never truncates silently.
 *
 * Called at planning time AND again at execution time: FASE 7 revalidates everything, because a
 * suspension between planning and sending must stop the send.
 */
@Injectable()
export class EnsureAccountCanDispatchUseCase implements UseCase<
  EnsureAccountCanDispatchCommand,
  DispatchAllowanceDto
> {
  private readonly logger = new Logger(EnsureAccountCanDispatchUseCase.name);

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(DAILY_SEND_USAGE) private readonly usage: DailySendUsagePort,
  ) {}

  async execute(command: EnsureAccountCanDispatchCommand): Promise<DispatchAllowanceDto> {
    const account = await this.accounts.findById(AccountId.from(command.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    if (!account.canDispatch) {
      this.logger.warn('Envio recusado: conta suspensa', { accountId: command.accountId });
      throw new AccountSuspendedException(account.suspensionReason ?? undefined);
    }

    const alreadySentToday = await this.usage.totalSentToday(account.id.value, account.timezone);

    // Throws when the request does not fit — reporting the excess is the caller's job.
    if (command.requestedSends > 0) {
      account.assertFitsDailyCeiling(command.requestedSends, alreadySentToday);
    }

    const dto = new DispatchAllowanceDto();
    dto.accountId = account.id.value;
    dto.dailySendCeiling = account.dailySendCeiling;
    dto.alreadySentToday = alreadySentToday;
    dto.remainingToday = account.remainingDailyAllowance(alreadySentToday);
    return dto;
  }
}
