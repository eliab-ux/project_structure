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
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
} from '../../../../../infrastructure/persistence/ports/event-publisher.port';
import { ReactivateAccountCommand } from './reactivate-account.command';

/**
 * Lifts a suspension. Distributions do NOT resume by themselves: they were paused, and resuming
 * is an explicit human action in the tenant's own screen (§10, FASE 7 item 8). Reactivating an
 * account must not silently start sending.
 */
@Injectable()
export class ReactivateAccountUseCase implements UseCase<ReactivateAccountCommand, AccountDto> {
  private readonly logger = new Logger(ReactivateAccountUseCase.name);

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ReactivateAccountCommand): Promise<AccountDto> {
    const account = await this.accounts.findById(AccountId.from(command.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    account.reactivate(command.performedBy);
    const saved = await this.accounts.save(account);

    await this.events.publishAll(account.pullDomainEvents());

    await this.audit.execute({
      accountId: saved.id.value,
      actorType: AuditActorType.PLATFORM_ADMIN,
      actorId: command.performedBy,
      action: AuditAction.ACCOUNT_REACTIVATED,
      entityType: 'account',
      entityId: saved.id.value,
      ip: command.ip,
    });

    this.logger.log('Conta reativada', { accountId: saved.id.value });
    return AccountDto.fromDomain(saved);
  }
}
