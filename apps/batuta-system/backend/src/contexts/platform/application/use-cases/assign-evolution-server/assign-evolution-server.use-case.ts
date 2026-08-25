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
import { InvalidEvolutionServerException } from '../../../domain/exceptions/invalid-evolution-server.exception';
import { AssignEvolutionServerCommand } from './assign-evolution-server.command';

/**
 * Moves a tenant to a dedicated Evolution server, or back to the shared platform one.
 *
 * This is the operational half of §14 decisão 7: "mover um tenant pesado ou arriscado para
 * servidor dedicado passa a ser atualizar uma linha". Triggers to do so (disproportionate chip
 * count, recurring abuse signals, contractual isolation) are monitored by a human, never
 * automated.
 */
@Injectable()
export class AssignEvolutionServerUseCase implements UseCase<
  AssignEvolutionServerCommand,
  AccountDto
> {
  private readonly logger = new Logger(AssignEvolutionServerUseCase.name);

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: AssignEvolutionServerCommand): Promise<AccountDto> {
    // Either both are set (dedicated) or both are null (back to shared). A URL without a key
    // would fail at the first send, in the worst possible place.
    const url = command.serverUrl?.trim() || null;
    const key = command.apiKey?.trim() || null;
    if ((url === null) !== (key === null)) {
      throw new InvalidEvolutionServerException();
    }
    if (url !== null && !/^https?:\/\/.+/i.test(url)) {
      throw new InvalidEvolutionServerException();
    }

    const account = await this.accounts.findById(AccountId.from(command.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    account.assignEvolutionServer(url, key);
    const saved = await this.accounts.save(account);

    await this.audit.execute({
      accountId: saved.id.value,
      actorType: AuditActorType.PLATFORM_ADMIN,
      actorId: command.performedBy,
      action: AuditAction.ACCOUNT_EVOLUTION_SERVER_CHANGED,
      entityType: 'account',
      entityId: saved.id.value,
      ip: command.ip,
      // The key is redacted by the audit entity; only the fact and the host are recorded.
      payload: { dedicated: url !== null, host: url ? new URL(url).host : null },
    });

    this.logger.log('Servidor Evolution da conta alterado', {
      accountId: saved.id.value,
      dedicated: url !== null,
    });
    return AccountDto.fromDomain(saved);
  }
}
