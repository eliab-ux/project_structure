import { AuditAction, AuditActorType } from '../../../domain/value-objects/audit-action.vo';

export class QueryAuditLogQuery {
  constructor(
    public readonly accountId: string,
    public readonly page?: number,
    public readonly limit?: number,
    public readonly action?: AuditAction,
    public readonly actorType?: AuditActorType,
    public readonly actorId?: string,
    public readonly entityType?: string,
    public readonly entityId?: string,
    public readonly from?: Date,
    public readonly to?: Date,
  ) {}
}
