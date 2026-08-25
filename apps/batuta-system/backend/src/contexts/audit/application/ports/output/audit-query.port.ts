import { PaginatedResult, PaginationParams } from '@gitspread/shared-kernel';
import { AuditLog } from '../../../domain/entities/audit-log.entity';
import { AuditAction, AuditActorType } from '../../../domain/value-objects/audit-action.vo';

export const AUDIT_LOG_QUERY = Symbol('AUDIT_LOG_QUERY');
export const DISTRIBUTION_REPORT_SOURCE = Symbol('DISTRIBUTION_REPORT_SOURCE');
export const HEALTH_PANEL_SOURCE = Symbol('HEALTH_PANEL_SOURCE');

export interface AuditQueryFilter extends PaginationParams {
  action?: AuditAction;
  actorType?: AuditActorType;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
}

/**
 * Reads the trail (§11 item 1).
 *
 * Split from AuditLogRepositoryPort on purpose: that port is append-only BY CONTRACT and adding a read
 * to it would blur the one thing it exists to guarantee. Reading and writing the trail are different
 * capabilities with different callers.
 */
export interface AuditLogQueryPort {
  query(filter: AuditQueryFilter): Promise<PaginatedResult<AuditLog>>;
  /** Distinct actions present in this account's trail, so the filter offers real options. */
  distinctActions(): Promise<AuditAction[]>;
}

/** One send, as the exported report shows it (§11 item 2). */
export interface ReportedDispatch {
  contactName: string | null;
  /** Masked in CSV/PDF too: the report is a document that leaves the system. */
  contactPhoneMasked: string;
  channelLabel: string;
  channelPhoneMasked: string;
  variantLabel: string;
  /** The EXACT text that was sent — `dispatches.rendered_body` (§4). */
  renderedBody: string;
  status: string;
  blockedReason: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  deliveryStatus: string | null;
  errorDetail: string | null;
}

/** Who approved what, and when (§11 item 2). */
export interface ReportedApproval {
  approverName: string;
  status: string;
  decidedAt: Date | null;
  /** The version approved — what makes the record defensible rather than decorative (§8 item 4). */
  contentHash: string;
  comment: string | null;
  decidedIp: string | null;
}

export interface DistributionReportData {
  distributionId: string;
  accountName: string;
  contentTitle: string;
  classification: string;
  contentHash: string;
  windowStart: Date;
  windowEnd: Date;
  status: string;
  createdByName: string;
  createdAt: Date;
  confirmedAt: Date | null;
  completedAt: Date | null;
  approvals: ReportedApproval[];
  dispatches: ReportedDispatch[];
  totals: {
    total: number;
    sent: number;
    failed: number;
    blocked: number;
    cancelled: number;
    pending: number;
  };
}

/**
 * Assembles the exportable report of one distribution.
 *
 * A port rather than a query in the use case because it joins five tables across four contexts, and the
 * use case's job is to FORMAT the answer, not to know the schema.
 */
export interface DistributionReportSourcePort {
  load(distributionId: string): Promise<DistributionReportData | null>;
}

export interface ChannelHealthRow {
  channelId: string;
  label: string;
  status: string;
  currentQuota: number;
  quotaFloor: number;
  quotaCeiling: number;
  /** Sends per day over the window, campaign and reply separately (§10.4). */
  daily: { date: string; campaignSends: number; replySends: number }[];
  /** Latest throttle decision WITH its reason (§11 item 3). */
  lastDecision: { date: string; decision: string; reason: string; computedQuota: number } | null;
  /**
   * Sends the rates below are computed over — the SAMPLE SIZE, and the panel needs it to tell "0% of
   * 400" from "0% of 3". Without it the assessment cannot apply the same minimum sample the throttle
   * applies, and would call a channel at risk over numbers the throttle itself refuses to act on.
   */
  sentCount: number;
  deliveryRate: number | null;
  inboundRate: number | null;
  optOutRate: number | null;
  failureRate: number | null;
  consecutiveFailures: number;
}

export interface HealthPanelData {
  windowDays: number;
  channels: ChannelHealthRow[];
  /** Inbound volume per day across every chip (§11 item 3). */
  inboundPerDay: { date: string; count: number }[];
  optOutsInWindow: number;
  contactsTotal: number;
  contactsRoutable: number;
}

export interface HealthPanelSourcePort {
  load(windowDays: number): Promise<HealthPanelData>;
}
