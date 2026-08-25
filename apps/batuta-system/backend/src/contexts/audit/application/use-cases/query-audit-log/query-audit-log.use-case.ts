import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult, Pagination, UseCase } from '@gitspread/shared-kernel';
import { AuditLog } from '../../../domain/entities/audit-log.entity';
import { AuditAction, AuditActorType } from '../../../domain/value-objects/audit-action.vo';
import { AUDIT_LOG_QUERY, AuditLogQueryPort } from '../../ports/output/audit-query.port';
import { QueryAuditLogQuery } from './query-audit-log.query';

/** How far back a single query may reach without a date filter. */
const DEFAULT_WINDOW_DAYS = 90;

export class AuditLogEntryDto {
  id!: string;
  actorType!: AuditActorType;
  actorId!: string | null;
  action!: AuditAction;
  entityType!: string | null;
  entityId!: string | null;
  payload!: Record<string, unknown>;
  ip!: string | null;
  createdAt!: Date;

  static fromDomain(log: AuditLog): AuditLogEntryDto {
    const dto = new AuditLogEntryDto();
    dto.id = log.id;
    dto.actorType = log.actorType;
    dto.actorId = log.actorId;
    dto.action = log.action;
    dto.entityType = log.entityType;
    dto.entityId = log.entityId;
    // Already sanitised on the way IN (§1.6 / CLAUDE.md): the writer strips secrets, so nothing here
    // needs a second pass. A filter applied only on read would leave the sensitive value in the table.
    dto.payload = log.payload;
    dto.ip = log.ip;
    dto.createdAt = log.createdAt;
    return dto;
  }
}

/**
 * Queries the trail (§11 item 1: filter by action, actor, entity, period).
 *
 * Two things worth stating about what this does NOT do:
 *
 *  - **No write path.** The repository that appends is a different port with no update and no delete
 *    (§1.6, append-only). Reading cannot alter the trail, by construction rather than by convention.
 *  - **No cross-tenant reach.** The query is scoped by the global filter like everything else, so an
 *    account admin sees their own account's history and nothing else. Platform-wide audit is the
 *    platform area's business (§11, FASE 10 screen 12).
 *
 * The 90-day default window is not a retention rule — §14 item 9 says audit does not expire. It is a
 * bound on ONE query, so an unfiltered request does not try to page through years of rows.
 */
@Injectable()
export class QueryAuditLogUseCase implements UseCase<
  QueryAuditLogQuery,
  PaginatedResult<AuditLogEntryDto>
> {
  constructor(@Inject(AUDIT_LOG_QUERY) private readonly logs: AuditLogQueryPort) {}

  async execute(query: QueryAuditLogQuery): Promise<PaginatedResult<AuditLogEntryDto>> {
    const from =
      query.from ??
      (query.to ? undefined : new Date(Date.now() - DEFAULT_WINDOW_DAYS * 86_400_000));

    const page = await this.logs.query({
      ...Pagination.create(query.page, query.limit),
      action: query.action,
      actorType: query.actorType,
      actorId: query.actorId,
      entityType: query.entityType,
      entityId: query.entityId,
      from,
      to: query.to,
    });

    return {
      data: page.data.map((log) => AuditLogEntryDto.fromDomain(log)),
      meta: page.meta,
    };
  }

  /** Actions actually present in this account's trail, so the filter offers real options. */
  async availableActions(): Promise<AuditAction[]> {
    return this.logs.distinctActions();
  }
}
