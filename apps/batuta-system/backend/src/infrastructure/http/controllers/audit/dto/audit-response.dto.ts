import { AuditLogEntryDto } from '../../../../../contexts/audit/application/use-cases/query-audit-log/query-audit-log.use-case';
import { HealthPanelDto } from '../../../../../contexts/audit/application/use-cases/get-health-panel/get-health-panel.use-case';

export class AuditLogResponseDto {
  id!: string;
  actorType!: string;
  actorId!: string | null;
  action!: string;
  entityType!: string | null;
  entityId!: string | null;
  /** Already sanitised when it was written (§1.6) — no secret ever reached the column. */
  payload!: Record<string, unknown>;
  ip!: string | null;
  createdAt!: Date;

  static from(dto: AuditLogEntryDto): AuditLogResponseDto {
    const response = new AuditLogResponseDto();
    response.id = dto.id;
    response.actorType = dto.actorType;
    response.actorId = dto.actorId;
    response.action = dto.action;
    response.entityType = dto.entityType;
    response.entityId = dto.entityId;
    response.payload = dto.payload;
    response.ip = dto.ip;
    response.createdAt = dto.createdAt;
    return response;
  }
}

export class HealthPanelResponseDto {
  windowDays!: number;
  channels!: HealthPanelDto['channels'];
  inboundPerDay!: HealthPanelDto['inboundPerDay'];
  optOutsInWindow!: number;
  contactsTotal!: number;
  contactsRoutable!: number;
  /** Sustained sends per day across connected chips. */
  dailyCapacity!: number;
  /** Days to cover the routable base at that capacity — §15 risco 3, stated instead of discovered. */
  daysToCoverBase!: number | null;

  static from(dto: HealthPanelDto): HealthPanelResponseDto {
    const response = new HealthPanelResponseDto();
    response.windowDays = dto.windowDays;
    response.channels = dto.channels;
    response.inboundPerDay = dto.inboundPerDay;
    response.optOutsInWindow = dto.optOutsInWindow;
    response.contactsTotal = dto.contactsTotal;
    response.contactsRoutable = dto.contactsRoutable;
    response.dailyCapacity = dto.dailyCapacity;
    response.daysToCoverBase = dto.daysToCoverBase;
    return response;
  }
}
