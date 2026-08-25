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
import { SuspendAccountCommand } from './suspend-account.command';

/**
 * Suspends a tenant. Platform-only.
 *
 * Effects of SUSPENDED, per §5 item 6: workers refuse to send (enforced by the dispatch gate),
 * `RUNNING` distributions go to `PAUSED` (a handler in the distribution context, FASE 6, reacts
 * to AccountSuspendedEvent), and login keeps working so the user can read the reason.
 *
 * The event is published only AFTER the change is persisted — a pause triggered by a suspension
 * that then failed to commit would be a lie.
 */
@Injectable()
export class SuspendAccountUseCase implements UseCase<SuspendAccountCommand, AccountDto> {
  private readonly logger = new Logger(SuspendAccountUseCase.name);

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: SuspendAccountCommand): Promise<AccountDto> {
    const account = await this.accounts.findById(AccountId.from(command.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    account.suspend(command.reason, command.performedBy);
    const saved = await this.accounts.save(account);

    await this.events.publishAll(account.pullDomainEvents());

    await this.audit.execute({
      accountId: saved.id.value,
      actorType: AuditActorType.PLATFORM_ADMIN,
      actorId: command.performedBy,
      action: AuditAction.ACCOUNT_SUSPENDED,
      entityType: 'account',
      entityId: saved.id.value,
      ip: command.ip,
      payload: { reason: command.reason },
    });

    this.logger.warn('Conta suspensa', { accountId: saved.id.value });
    return AccountDto.fromDomain(saved);
  }
}
