import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import { AuditAction, AuditActorType } from '../../domain/value-objects/audit-action.vo';
import {
  AUDIT_LOG_REPOSITORY,
  AuditLogRepositoryPort,
} from '../ports/output/audit-log-repository.port';

export interface RecordAuditLogCommand {
  accountId: string | null;
  actorType: AuditActorType;
  actorId: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * The single way a line enters the audit trail. Sanitization happens in the domain entity, so
 * no caller can bypass it.
 *
 * A failure to write the trail is logged and swallowed **for auth events** only through the
 * caller's choice; here it propagates, because for business actions a lost audit line is worse
 * than a failed request. Callers that must never fail because of auditing say so explicitly.
 */
@Injectable()
export class RecordAuditLogUseCase implements UseCase<RecordAuditLogCommand, void> {
  private readonly logger = new Logger(RecordAuditLogUseCase.name);

  constructor(@Inject(AUDIT_LOG_REPOSITORY) private readonly repository: AuditLogRepositoryPort) {}

  async execute(command: RecordAuditLogCommand): Promise<void> {
    const log = AuditLog.record(command);
    await this.repository.append(log);
    this.logger.debug('Audit log gravado', { action: log.action, accountId: log.accountId });
  }
}
