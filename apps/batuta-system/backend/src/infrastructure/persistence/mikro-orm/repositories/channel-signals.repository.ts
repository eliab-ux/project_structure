import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  ChannelDailyCounterRepositoryPort,
  ChannelQualitySnapshotRecord,
  ChannelQualitySnapshotRepositoryPort,
  ChannelSignalSourcePort,
} from '../../../../contexts/channel/application/ports/output/channel-signals.port';
import { ChannelDaySignals } from '../../../../contexts/channel/domain/services/throttle-policy';
import { DELIVERED_ACK_STATUSES } from '../../../../contexts/distribution/domain/value-objects/delivery-ack.vo';
import { ChannelDailyCounterOrmEntity } from '../entities/channel-daily-counter-orm.entity';
import { ChannelQualitySnapshotOrmEntity } from '../entities/channel-quality-snapshot-orm.entity';
import { ChannelOrmEntity } from '../entities/channel-orm.entity';
import { ScopedRawQueryService } from '../scoped-raw-query.service';

/** Local date (YYYY-MM-DD) N days back from a reference day. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return isoDate(date);
}

@Injectable()
export class MikroOrmChannelDailyCounterRepository implements ChannelDailyCounterRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async findForChannelAndDate(
    channelId: string,
    date: string,
  ): Promise<{ campaignSends: number; replySends: number }> {
    const row = await this.em.findOne(ChannelDailyCounterOrmEntity, { channelId, date });
    return {
      campaignSends: row?.campaignSends ?? 0,
      replySends: row?.replySends ?? 0,
    };
  }

  async totalForAccountAndDate(accountId: string, date: string): Promise<number> {
    // Tenant-scoped by the global filter; accountId is passed only so the caller states whose
    // usage it is reading, which keeps the call site readable.
    const rows = await this.em.find(ChannelDailyCounterOrmEntity, { accountId, date });
    return rows.reduce((total, row) => total + row.campaignSends + row.replySends, 0);
  }

  /**
   * The atomic increment of §10, FASE 7 item 5 — written as raw SQL because that is the only way to
   * express "insert or add one, and tell me the result" in a single statement.
   *
   * It carries `account_id` explicitly: raw SQL does not see the global tenant filter, and the value
   * comes from the JOB PAYLOAD rather than from anything the row itself claims.
   *
   * Note `where channel_id = ... and date = ...` on the conflict target: the unique key of §4 is
   * (channel_id, date), so a second worker incrementing the same channel on the same day lands on the
   * UPDATE branch instead of inserting a duplicate row.
   */
  async incrementCampaignSend(accountId: string, channelId: string, date: string): Promise<number> {
    return this.increment('campaign_sends', accountId, channelId, date);
  }

  async incrementReplySend(accountId: string, channelId: string, date: string): Promise<number> {
    return this.increment('reply_sends', accountId, channelId, date);
  }

  private async increment(
    column: 'campaign_sends' | 'reply_sends',
    accountId: string,
    channelId: string,
    date: string,
  ): Promise<number> {
    const other = column === 'campaign_sends' ? 'reply_sends' : 'campaign_sends';
    // `column` is not user input: it is one of two literals chosen by the two methods above.
    const rows = await this.em.getKnex().raw(
      `insert into channel_daily_counters
         (id, account_id, channel_id, date, ${column}, ${other}, created_at)
       values (gen_random_uuid(), ?, ?, ?, 1, 0, now())
       on conflict (channel_id, date)
       do update set ${column} = channel_daily_counters.${column} + 1
       returning ${column} as total`,
      [accountId, channelId, date],
    );
    const result = (rows?.rows ?? rows) as { total: number | string }[];
    return Number(result[0]?.total ?? 0);
  }

  async listForChannelBetween(
    channelId: string,
    from: string,
    to: string,
  ): Promise<{ date: string; campaignSends: number; replySends: number }[]> {
    const rows = await this.em.find(
      ChannelDailyCounterOrmEntity,
      { channelId, date: { $gte: from, $lte: to } },
      { orderBy: { date: 'ASC' } },
    );
    return rows.map((row) => ({
      date: row.date,
      campaignSends: row.campaignSends,
      replySends: row.replySends,
    }));
  }
}

@Injectable()
export class MikroOrmChannelQualitySnapshotRepository implements ChannelQualitySnapshotRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async upsert(accountId: string, record: ChannelQualitySnapshotRecord): Promise<void> {
    await this.em.upsert(
      ChannelQualitySnapshotOrmEntity,
      {
        id: randomUUID(),
        accountId,
        channelId: record.channelId,
        date: record.date,
        sentCount: record.sentCount,
        failedCount: record.failedCount,
        deliveredCount: record.deliveredCount,
        inboundCount: record.inboundCount,
        optOutCount: record.optOutCount,
        disconnectEvents: record.disconnectEvents,
        computedQuota: record.computedQuota,
        decision: record.decision,
        reason: record.reason,
        createdAt: new Date(),
      },
      // Idempotent per (channel, date): a re-run of the daily job overwrites rather than duplicates.
      { onConflictFields: ['channelId', 'date'], onConflictExcludeFields: ['id', 'createdAt'] },
    );
    await this.em.flush();
  }

  async listForChannel(channelId: string, limit: number): Promise<ChannelQualitySnapshotRecord[]> {
    const rows = await this.em.find(
      ChannelQualitySnapshotOrmEntity,
      { channelId },
      { orderBy: { date: 'DESC' }, limit },
    );

    return rows.map((row) => ({
      channelId: row.channelId,
      date: row.date,
      sentCount: row.sentCount,
      failedCount: row.failedCount,
      deliveredCount: row.deliveredCount,
      inboundCount: row.inboundCount,
      optOutCount: row.optOutCount,
      disconnectEvents: row.disconnectEvents,
      computedQuota: row.computedQuota,
      decision: row.decision,
      reason: row.reason,
    }));
  }
}

/** The four outcome metrics, derived from the tables that actually record them. */
interface DayOutcomes {
  failedCount: number;
  deliveredCount: number;
  optOutCount: number;
  inboundCount: number;
}

function emptyOutcomes(): DayOutcomes {
  return { failedCount: 0, deliveredCount: 0, optOutCount: 0, inboundCount: 0 };
}

/**
 * Assembles the daily signals the throttle reads.
 *
 * Where each of the six comes from:
 *  - `sentCount` → `channel_daily_counters` (campaign + reply), the quota counter itself;
 *  - `disconnectEvents` → today's running count on the channel, history from past snapshots (the
 *    channel's counter is reset when a day closes, so the snapshot is the only record);
 *  - `deliveredCount` / `failedCount` → aggregated from `dispatches`;
 *  - `inboundCount` → aggregated from `messages`;
 *  - `optOutCount` → aggregated from `contacts.opted_out_at`.
 *
 * The four outcome metrics used to be hardcoded to 0 here, waiting on FASE 7/8. That left
 * `delivered_count` at zero while `sent_count` was real, which is the precise failure the port doc
 * warned about: every channel reads as 0% delivered, the policy takes that for blocking, and every
 * quota walks down to the floor. They are computed for real now.
 *
 * **They are recomputed live rather than read back from the snapshot, and that is deliberate.** A read
 * receipt can arrive days after the send; a snapshot frozen at midnight would record the acks that had
 * arrived by then and punish the chip for the ones still in flight. Recomputing means a late ack repairs
 * its own day. The snapshot keeps being written, because it is the record of what was DECIDED and why —
 * an audit trail, not a cache to read metrics back from.
 *
 * Day bucketing follows the ACCOUNT's timezone, read inside the query, because that is the calendar
 * `channel_daily_counters` is keyed by (`localDateKey(now, account.timezone)` at send time). Bucketing
 * the numerator by UTC while the denominator uses São Paulo would misfile every send near midnight.
 */
@Injectable()
export class MikroOrmChannelSignalSource implements ChannelSignalSourcePort {
  constructor(
    private readonly em: EntityManager,
    private readonly raw: ScopedRawQueryService,
  ) {}

  async recentDays(channelId: string, days: number): Promise<ChannelDaySignals[]> {
    const from = daysAgo(days);
    const today = isoDate(new Date());

    const [snapshots, counters, channel, outcomes] = await Promise.all([
      this.em.find(
        ChannelQualitySnapshotOrmEntity,
        { channelId, date: { $gte: from } },
        { orderBy: { date: 'ASC' } },
      ),
      this.em.find(
        ChannelDailyCounterOrmEntity,
        { channelId, date: { $gte: from } },
        { orderBy: { date: 'ASC' } },
      ),
      this.em.findOne(ChannelOrmEntity, { id: channelId }),
      this.outcomesByDate(channelId, from),
    ]);

    const byDate = new Map<string, ChannelDaySignals>();

    for (const counter of counters) {
      byDate.set(counter.date, {
        date: counter.date,
        sentCount: counter.campaignSends + counter.replySends,
        ...emptyOutcomes(),
        disconnectEvents: 0,
      });
    }

    // The snapshot supplies what cannot be recomputed: the disconnect count of a day already closed.
    // `sentCount` falls back to it only if the counter row is gone.
    for (const snapshot of snapshots) {
      const fromCounter = byDate.get(snapshot.date);
      byDate.set(snapshot.date, {
        date: snapshot.date,
        sentCount: fromCounter?.sentCount ?? snapshot.sentCount,
        ...emptyOutcomes(),
        disconnectEvents: snapshot.disconnectEvents,
      });
    }

    // Today has no snapshot yet, so the live disconnect counter on the channel is the only source.
    const todaySignals = byDate.get(today) ?? {
      date: today,
      sentCount: 0,
      ...emptyOutcomes(),
      disconnectEvents: 0,
    };
    todaySignals.disconnectEvents = channel?.disconnectEventsToday ?? 0;
    if (todaySignals.sentCount > 0 || todaySignals.disconnectEvents > 0) {
      byDate.set(today, todaySignals);
    }

    // Overlaid only onto days that already exist — a day with no sends and no disconnect has no
    // denominator, so a rate for it would be meaningless and `evaluateThrottle` discards it anyway.
    for (const [date, outcome] of outcomes) {
      const day = byDate.get(date);
      if (day) {
        Object.assign(day, outcome);
      }
    }

    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  async forDate(channelId: string, date: string): Promise<ChannelDaySignals> {
    const [counter, channel, outcomes] = await Promise.all([
      this.em.findOne(ChannelDailyCounterOrmEntity, { channelId, date }),
      this.em.findOne(ChannelOrmEntity, { id: channelId }),
      this.outcomesByDate(channelId, date, date),
    ]);

    const isToday = date === isoDate(new Date());

    return {
      date,
      sentCount: (counter?.campaignSends ?? 0) + (counter?.replySends ?? 0),
      ...(outcomes.get(date) ?? emptyOutcomes()),
      disconnectEvents: isToday ? (channel?.disconnectEventsToday ?? 0) : 0,
    };
  }

  /**
   * The four outcome metrics per local day, for one channel.
   *
   * Three queries because they read three tables; each one groups server-side rather than dragging rows
   * into Node. They go through ScopedRawQueryService, the only authorised path for raw SQL: it injects
   * `:accountId` from the tenant scope (established by TenantScopedJobRunner for the daily review job,
   * by the guard for an HTTP request) and refuses SQL that does not reference it.
   *
   * `sinceInstant` / `untilInstant` are deliberately loose — the exact boundary is the local-date filter
   * in the outer WHERE; the instants exist so the scan can use the timestamp indexes instead of walking
   * the table. Two days of slack covers every timezone offset on earth.
   */
  private async outcomesByDate(
    channelId: string,
    fromDate: string,
    toDate?: string,
  ): Promise<Map<string, DayOutcomes>> {
    const sinceInstant = new Date(Date.parse(`${fromDate}T00:00:00Z`) - 2 * 86_400_000);
    const untilInstant = toDate
      ? new Date(Date.parse(`${toDate}T00:00:00Z`) + 3 * 86_400_000)
      : null;

    const bindings: Record<string, unknown> = { channelId, sinceInstant, fromDate };
    if (untilInstant) {
      bindings.untilInstant = untilInstant;
    }
    if (toDate) {
      bindings.toDate = toDate;
    }
    // Optional clauses, built once. Each is either empty or references a binding that exists above.
    const dispatchCeiling = untilInstant
      ? 'and coalesce(d.sent_at, d.scheduled_at) <= :untilInstant'
      : '';
    const inboundCeiling = untilInstant ? 'and m.occurred_at <= :untilInstant' : '';
    const optOutCeiling = untilInstant ? 'and c.opted_out_at <= :untilInstant' : '';
    const dateCeiling = toDate ? 'and bucket.date <= :toDate' : '';

    const [dispatchRows, inboundRows, optOutRows] = await Promise.all([
      // `sent_at` for a SENT row, `scheduled_at` for a FAILED one: markFailed never sets sent_at, so a
      // failure bucketed by sent_at alone would vanish from the day it happened on.
      this.raw.scoped<{ date: string; delivered_count: string; failed_count: string }>(
        `with acct as (select timezone as tz from accounts where id = :accountId),
              bucket as (
                select to_char(coalesce(d.sent_at, d.scheduled_at) at time zone acct.tz, 'YYYY-MM-DD') as date,
                       d.status,
                       upper(btrim(coalesce(d.delivery_status, ''))) as ack
                  from dispatches d cross join acct
                 where d.account_id = :accountId
                   and d.channel_id = :channelId
                   and (d.sent_at >= :sinceInstant or d.scheduled_at >= :sinceInstant)
                   ${dispatchCeiling}
              )
         select bucket.date,
                count(*) filter (
                  where bucket.status = 'SENT'
                    and bucket.ack = any(string_to_array(:deliveredStatuses, ','))
                ) as delivered_count,
                count(*) filter (where bucket.status = 'FAILED') as failed_count
           from bucket
          where bucket.date >= :fromDate ${dateCeiling}
          group by bucket.date`,
        { ...bindings, deliveredStatuses: DELIVERED_ACK_STATUSES.join(',') },
      ),
      this.raw.scoped<{ date: string; inbound_count: string }>(
        `with acct as (select timezone as tz from accounts where id = :accountId),
              bucket as (
                select to_char(m.occurred_at at time zone acct.tz, 'YYYY-MM-DD') as date
                  from messages m cross join acct
                 where m.account_id = :accountId
                   and m.channel_id = :channelId
                   and m.direction = 'INBOUND'
                   and m.occurred_at >= :sinceInstant
                   ${inboundCeiling}
              )
         select bucket.date, count(*) as inbound_count
           from bucket
          where bucket.date >= :fromDate ${dateCeiling}
          group by bucket.date`,
        bindings,
      ),
      // Attributed to the contact's CURRENT channel, the only link the schema keeps between an opt-out
      // and a chip. A §6.4 re-homing therefore moves past opt-outs to the new chip; accepted, because
      // the alternative is joining the inbound message that triggered it and opt-out can also come from
      // an operator action with no message at all.
      this.raw.scoped<{ date: string; opt_out_count: string }>(
        `with acct as (select timezone as tz from accounts where id = :accountId),
              bucket as (
                select to_char(c.opted_out_at at time zone acct.tz, 'YYYY-MM-DD') as date
                  from contacts c cross join acct
                 where c.account_id = :accountId
                   and c.current_channel_id = :channelId
                   and c.opted_out_at is not null
                   and c.opted_out_at >= :sinceInstant
                   ${optOutCeiling}
              )
         select bucket.date, count(*) as opt_out_count
           from bucket
          where bucket.date >= :fromDate ${dateCeiling}
          group by bucket.date`,
        bindings,
      ),
    ]);

    const byDate = new Map<string, DayOutcomes>();
    const at = (date: string): DayOutcomes => {
      const existing = byDate.get(date);
      if (existing) {
        return existing;
      }
      const created = emptyOutcomes();
      byDate.set(date, created);
      return created;
    };

    for (const row of dispatchRows) {
      const day = at(row.date);
      day.deliveredCount = Number(row.delivered_count);
      day.failedCount = Number(row.failed_count);
    }
    for (const row of inboundRows) {
      at(row.date).inboundCount = Number(row.inbound_count);
    }
    for (const row of optOutRows) {
      at(row.date).optOutCount = Number(row.opt_out_count);
    }

    return byDate;
  }
}
