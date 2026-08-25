import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { PaginatedResult, Pagination } from '@gitspread/shared-kernel';
import {
  AuditLogQueryPort,
  AuditQueryFilter,
  DistributionReportData,
  DistributionReportSourcePort,
  HealthPanelData,
  HealthPanelSourcePort,
  ReportedApproval,
  ReportedDispatch,
} from '../../../../contexts/audit/application/ports/output/audit-query.port';
import { AuditLog } from '../../../../contexts/audit/domain/entities/audit-log.entity';
import { AuditAction } from '../../../../contexts/audit/domain/value-objects/audit-action.vo';
import { DELIVERED_ACK_STATUSES } from '../../../../contexts/distribution/domain/value-objects/delivery-ack.vo';
import { AuditLogOrmEntity } from '../entities/audit-log-orm.entity';
import { ScopedRawQueryService } from '../scoped-raw-query.service';

/**
 * Raw SQL does not go through the ORM's type parsing, so a `timestamptz` can arrive as a string.
 *
 * Coercing here rather than trusting the driver: the failure mode is a `TypeError` deep inside a PDF
 * renderer, which is a long way from the cause.
 */
function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  return toDate(value);
}

/** Masks a phone the same way PhoneE164 does, for rows that come back as raw SQL. */
function maskPhone(phone: string | null): string {
  if (!phone) {
    return '';
  }
  return phone.length <= 8 ? phone : `${phone.slice(0, 6)}*****${phone.slice(-4)}`;
}

@Injectable()
export class MikroOrmAuditLogQuery implements AuditLogQueryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly raw: ScopedRawQueryService,
  ) {}

  async query(filter: AuditQueryFilter): Promise<PaginatedResult<AuditLog>> {
    const params = Pagination.create(filter.page, filter.limit);
    const where: Record<string, unknown> = {};

    if (filter.action) {
      where.action = filter.action;
    }
    if (filter.actorType) {
      where.actorType = filter.actorType;
    }
    if (filter.actorId) {
      where.actorId = filter.actorId;
    }
    if (filter.entityType) {
      where.entityType = filter.entityType;
    }
    if (filter.entityId) {
      where.entityId = filter.entityId;
    }
    if (filter.from || filter.to) {
      where.createdAt = {
        ...(filter.from ? { $gte: filter.from } : {}),
        ...(filter.to ? { $lte: filter.to } : {}),
      };
    }

    const [rows, total] = await this.em.findAndCount(AuditLogOrmEntity, where, {
      limit: params.limit,
      offset: (params.page - 1) * params.limit,
      // Newest first: the trail is read to answer "what just happened?" far more often than "what
      // happened first?".
      orderBy: { createdAt: 'DESC' },
    });

    return Pagination.createResult(
      rows.map((row) =>
        AuditLog.reconstitute({
          id: row.id,
          accountId: row.accountId,
          actorType: row.actorType,
          actorId: row.actorId,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          payload: row.payload ?? {},
          ip: row.ip,
          createdAt: row.createdAt,
        }),
      ),
      total,
      params,
    );
  }

  async distinctActions(): Promise<AuditAction[]> {
    const rows = await this.raw.scoped<{ action: string }>(
      `select distinct action from audit_logs where account_id = :accountId order by action`,
    );
    return rows.map((row) => row.action as AuditAction);
  }
}

/**
 * Assembles the exportable report (§11 item 2).
 *
 * Every query goes through the scoped raw service, which refuses SQL without `:accountId`. That matters
 * more here than anywhere else in the system: this is the one code path whose output leaves the building
 * as a file, so a missing tenant clause would not just leak data — it would leak it into a document
 * someone attaches to a letter.
 */
@Injectable()
export class MikroOrmDistributionReportSource implements DistributionReportSourcePort {
  constructor(private readonly raw: ScopedRawQueryService) {}

  async load(distributionId: string): Promise<DistributionReportData | null> {
    const header = await this.raw.scoped<{
      id: string;
      account_name: string;
      content_id: string;
      content_title: string;
      classification: string;
      content_hash: string;
      window_start: Date;
      window_end: Date;
      status: string;
      created_by_name: string | null;
      created_at: Date;
      confirmed_at: Date | null;
      completed_at: Date | null;
      planned_hash: string | null;
    }>(
      `select d.id,
              a.name as account_name,
              c.id as content_id,
              c.title as content_title,
              c.classification,
              c.content_hash,
              d.window_start,
              d.window_end,
              d.status,
              u.name as created_by_name,
              d.created_at,
              d.confirmed_at,
              d.completed_at,
              d.config->>'contentHash' as planned_hash
         from distributions d
         join accounts a on a.id = d.account_id
         join contents c on c.id = d.content_id
         left join users u on u.id = d.created_by
        where d.account_id = :accountId and d.id = :distributionId`,
      { distributionId },
    );

    const row = header[0];
    if (!row) {
      return null;
    }

    const approvalRows = await this.raw.scoped<{
      approver_name: string | null;
      status: string;
      decided_at: Date | null;
      content_hash: string;
      comment: string | null;
      decided_ip: string | null;
    }>(
      `select ap.name as approver_name,
              r.status,
              r.decided_at,
              r.content_hash,
              r.comment,
              r.decided_ip
         from approval_requests r
         left join approvers ap on ap.id = r.approver_id
        where r.account_id = :accountId and r.content_id = :contentId
        order by r.decided_at nulls last, r.created_at`,
      { contentId: row.content_id },
    );

    const dispatchRows = await this.raw.scoped<{
      contact_name: string | null;
      contact_phone: string | null;
      channel_label: string | null;
      channel_phone: string | null;
      variant_label: string | null;
      rendered_body: string;
      status: string;
      blocked_reason: string | null;
      scheduled_at: Date | null;
      sent_at: Date | null;
      delivery_status: string | null;
      error_detail: string | null;
    }>(
      `select ct.name as contact_name,
              ct.phone_e164 as contact_phone,
              ch.label as channel_label,
              ch.phone_e164 as channel_phone,
              cv.label as variant_label,
              dp.rendered_body,
              dp.status,
              dp.blocked_reason,
              dp.scheduled_at,
              dp.sent_at,
              dp.delivery_status,
              dp.error_detail
         from dispatches dp
         join contacts ct on ct.id = dp.contact_id
         left join channels ch on ch.id = dp.channel_id
         left join content_variants cv on cv.id = dp.variant_id
        where dp.account_id = :accountId and dp.distribution_id = :distributionId
        order by dp.sent_at nulls last, dp.scheduled_at nulls last`,
      { distributionId },
    );

    const totals = {
      total: dispatchRows.length,
      sent: dispatchRows.filter((entry) => entry.status === 'SENT').length,
      failed: dispatchRows.filter((entry) => entry.status === 'FAILED').length,
      blocked: dispatchRows.filter((entry) => entry.status === 'BLOCKED').length,
      cancelled: dispatchRows.filter((entry) => entry.status === 'CANCELLED').length,
      pending: dispatchRows.filter(
        (entry) => entry.status === 'PENDING' || entry.status === 'SENDING',
      ).length,
    };

    const approvals: ReportedApproval[] = approvalRows.map((entry) => ({
      approverName: entry.approver_name ?? 'Aprovador removido',
      status: entry.status,
      decidedAt: toDateOrNull(entry.decided_at),
      contentHash: entry.content_hash,
      comment: entry.comment,
      decidedIp: entry.decided_ip,
    }));

    const dispatches: ReportedDispatch[] = dispatchRows.map((entry) => ({
      contactName: entry.contact_name,
      // Masked here, not in the template: the masking has to hold whichever format is exported.
      contactPhoneMasked: maskPhone(entry.contact_phone),
      channelLabel: entry.channel_label ?? 'Canal removido',
      channelPhoneMasked: maskPhone(entry.channel_phone),
      variantLabel: entry.variant_label ?? 'Base',
      renderedBody: entry.rendered_body,
      status: entry.status,
      blockedReason: entry.blocked_reason,
      scheduledAt: toDateOrNull(entry.scheduled_at),
      sentAt: toDateOrNull(entry.sent_at),
      deliveryStatus: entry.delivery_status,
      errorDetail: entry.error_detail,
    }));

    return {
      distributionId: row.id,
      accountName: row.account_name,
      contentTitle: row.content_title,
      classification: row.classification,
      // The hash the plan was BUILT from, when recorded: that is the version the approvals refer to.
      // Falling back to the content's current hash would silently claim the wrong version was approved.
      contentHash: row.planned_hash ?? row.content_hash,
      windowStart: toDate(row.window_start),
      windowEnd: toDate(row.window_end),
      status: row.status,
      createdByName: row.created_by_name ?? 'Usuário removido',
      createdAt: toDate(row.created_at),
      confirmedAt: toDateOrNull(row.confirmed_at),
      completedAt: toDateOrNull(row.completed_at),
      approvals,
      dispatches,
      totals,
    };
  }
}

/** The health panel's data (§11 item 3). */
@Injectable()
export class MikroOrmHealthPanelSource implements HealthPanelSourcePort {
  constructor(private readonly raw: ScopedRawQueryService) {}

  async load(windowDays: number): Promise<HealthPanelData> {
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const sinceDate = since.toISOString().slice(0, 10);

    const channels = await this.raw.scoped<{
      id: string;
      label: string;
      status: string;
      current_quota: number;
      quota_floor: number;
      quota_ceiling: number;
      consecutive_failures: number;
    }>(
      `select id, label, status, current_quota, quota_floor, quota_ceiling, consecutive_failures
         from channels
        where account_id = :accountId
        order by label`,
    );

    const counters = await this.raw.scoped<{
      channel_id: string;
      date: string;
      campaign_sends: number;
      reply_sends: number;
    }>(
      `select channel_id, date, campaign_sends, reply_sends
         from channel_daily_counters
        where account_id = :accountId and date >= :sinceDate
        order by date`,
      { sinceDate },
    );

    // The snapshots are where the throttle records WHY it moved a quota (§2.1 item 6), which is exactly
    // what the panel has to show next to the number.
    const snapshots = await this.raw.scoped<{
      channel_id: string;
      date: string;
      decision: string;
      reason: string;
      computed_quota: number;
      sent_count: number;
      failed_count: number;
      delivered_count: number;
      inbound_count: number;
      opt_out_count: number;
    }>(
      `select channel_id, date, decision, reason, computed_quota,
              sent_count, failed_count, delivered_count, inbound_count, opt_out_count
         from channel_quality_snapshots
        where account_id = :accountId and date >= :sinceDate
        order by date`,
      { sinceDate },
    );

    const inboundPerDay = await this.raw.scoped<{ date: string; count: string }>(
      `select to_char(occurred_at, 'YYYY-MM-DD') as date, count(*) as count
         from messages
        where account_id = :accountId and direction = 'INBOUND' and occurred_at >= :since
        group by 1
        order by 1`,
      { since },
    );

    const contactRows = await this.raw.scoped<{
      total: string;
      routable: string;
      opted_out_in_window: string;
    }>(
      `select count(*) as total,
              count(*) filter (where active = true and opted_out_at is null) as routable,
              count(*) filter (where opted_out_at >= :since) as opted_out_in_window
         from contacts
        where account_id = :accountId`,
      { since },
    );

    /**
     * Outcomes per channel, recomputed from the tables that record them — NOT summed from the snapshots.
     *
     * The snapshot is the record of what the throttle DECIDED and why, which is why `lastDecision` still
     * comes from it. It is not a place to read metrics back from: a snapshot is frozen when the day
     * closes, and a read receipt can arrive days after the send. Worse, the throttle already recomputes
     * these live, so summing frozen values here made the SCREEN and the ENGINE disagree about the same
     * channel — the one thing the assessment doc says must never happen.
     *
     * This is also what makes the panel self-healing: it no longer depends on a backfill of history to
     * stop reporting a chip as blocked.
     */
    const outcomes = await this.raw.scoped<{
      channel_id: string;
      delivered_count: string;
      failed_count: string;
      inbound_count: string;
      opt_out_count: string;
    }>(
      `with acct as (select timezone as tz from accounts where id = :accountId),
            sent as (
              select d.channel_id,
                     count(*) filter (
                       where d.status = 'SENT'
                         and upper(btrim(coalesce(d.delivery_status, ''))) =
                             any(string_to_array(:deliveredStatuses, ','))
                     ) as delivered_count,
                     count(*) filter (where d.status = 'FAILED') as failed_count
                from dispatches d cross join acct
               where d.account_id = :accountId
                 and d.channel_id is not null
                 and (d.sent_at >= :since or d.scheduled_at >= :since)
                 and to_char(coalesce(d.sent_at, d.scheduled_at) at time zone acct.tz,
                             'YYYY-MM-DD') >= :sinceDate
               group by d.channel_id
            ),
            inbound as (
              select m.channel_id, count(*) as inbound_count
                from messages m
               where m.account_id = :accountId and m.direction = 'INBOUND' and m.occurred_at >= :since
               group by m.channel_id
            ),
            opted as (
              select c.current_channel_id as channel_id, count(*) as opt_out_count
                from contacts c
               where c.account_id = :accountId and c.opted_out_at >= :since
               group by c.current_channel_id
            )
       select ch.id as channel_id,
              coalesce(sent.delivered_count, 0) as delivered_count,
              coalesce(sent.failed_count, 0) as failed_count,
              coalesce(inbound.inbound_count, 0) as inbound_count,
              coalesce(opted.opt_out_count, 0) as opt_out_count
         from channels ch
         left join sent on sent.channel_id = ch.id
         left join inbound on inbound.channel_id = ch.id
         left join opted on opted.channel_id = ch.id
        where ch.account_id = :accountId`,
      { since, sinceDate, deliveredStatuses: DELIVERED_ACK_STATUSES.join(',') },
    );

    const outcomeByChannel = new Map(outcomes.map((row) => [row.channel_id, row]));

    const byChannel = new Map<string, typeof snapshots>();
    for (const snapshot of snapshots) {
      const list = byChannel.get(snapshot.channel_id) ?? [];
      list.push(snapshot);
      byChannel.set(snapshot.channel_id, list);
    }

    return {
      windowDays,
      channels: channels.map((channel) => {
        const daily = counters
          .filter((counter) => counter.channel_id === channel.id)
          .map((counter) => ({
            date: counter.date,
            campaignSends: Number(counter.campaign_sends),
            replySends: Number(counter.reply_sends),
          }));

        const channelSnapshots = byChannel.get(channel.id) ?? [];
        const last = channelSnapshots[channelSnapshots.length - 1];

        // `sent` from the quota counters, the same source the throttle divides by — and the same rows the
        // `daily` chart above is built from, so the number under the chart always matches the chart.
        const sent = daily.reduce((total, day) => total + day.campaignSends + day.replySends, 0);

        const outcome = outcomeByChannel.get(channel.id);
        const delivered = Number(outcome?.delivered_count ?? 0);
        const failed = Number(outcome?.failed_count ?? 0);
        const inbound = Number(outcome?.inbound_count ?? 0);
        const optOuts = Number(outcome?.opt_out_count ?? 0);

        return {
          channelId: channel.id,
          label: channel.label,
          status: channel.status,
          currentQuota: Number(channel.current_quota),
          quotaFloor: Number(channel.quota_floor),
          quotaCeiling: Number(channel.quota_ceiling),
          daily,
          lastDecision: last
            ? {
                date: last.date,
                decision: last.decision,
                reason: last.reason,
                computedQuota: Number(last.computed_quota),
              }
            : null,
          sentCount: sent,
          // Null rather than 0 when there is no sample: "no data" and "0%" mean opposite things, and
          // showing 0% delivery for a chip that never sent would look like a catastrophe.
          //
          // Note what this guard does NOT cover, because it cost us a false alarm in production: a chip
          // that DID send, whose acks were never counted, has sent > 0 and delivered = 0 and so reports
          // a hard 0%. Absence of data is indistinguishable from total failure once there is a
          // denominator — which is why the assessment also applies a minimum sample.
          deliveryRate: sent > 0 ? delivered / sent : null,
          inboundRate: sent > 0 ? inbound / sent : null,
          optOutRate: sent > 0 ? optOuts / sent : null,
          failureRate: sent > 0 ? failed / sent : null,
          consecutiveFailures: Number(channel.consecutive_failures),
        };
      }),
      inboundPerDay: inboundPerDay.map((entry) => ({
        date: entry.date,
        count: Number(entry.count),
      })),
      optOutsInWindow: Number(contactRows[0]?.opted_out_in_window ?? 0),
      contactsTotal: Number(contactRows[0]?.total ?? 0),
      contactsRoutable: Number(contactRows[0]?.routable ?? 0),
    };
  }
}
