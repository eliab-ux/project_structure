import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountDto } from '../../../../account/application/dto/account.dto';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { AccountNotFoundException } from '../../../../account/domain/exceptions/account-not-found.exception';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { ChangeDailyCeilingCommand } from './change-daily-ceiling.command';

/**
 * Changes the account-wide daily ceiling. Platform-only: the tenant must not be able to raise its
 * own ceiling, otherwise the ceiling stops being a platform control against abuse (§15, risco 7).
 */
@Injectable()
export class ChangeDailyCeilingUseCase implements UseCase<ChangeDailyCeilingCommand, AccountDto> {
  private readonly logger = new Logger(ChangeDailyCeilingUseCase.name);

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ChangeDailyCeilingCommand): Promise<AccountDto> {
    const account = await this.accounts.findById(AccountId.from(command.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    const previous = account.dailySendCeiling;
    account.changeDailySendCeiling(command.dailySendCeiling);
    const saved = await this.accounts.save(account);

    await this.audit.execute({
      accountId: saved.id.value,
      actorType: AuditActorType.PLATFORM_ADMIN,
      actorId: command.performedBy,
      action: AuditAction.ACCOUNT_CEILING_CHANGED,
      entityType: 'account',
      entityId: saved.id.value,
      ip: command.ip,
      payload: { from: previous, to: saved.dailySendCeiling },
    });

    this.logger.log('Teto diário alterado', {
      accountId: saved.id.value,
      from: previous,
      to: saved.dailySendCeiling,
    });
    return AccountDto.fromDomain(saved);
  }
}
