import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { PaginatedResult, Pagination, PaginationParams } from '@gitspread/shared-kernel';
import {
  BlockedSummary,
  DispatchCounts,
  DispatchRepositoryPort,
  DispatchesByChannel,
  DistributionRepositoryPort,
  ListDistributionsFilter,
} from '../../../../contexts/distribution/application/ports/output/distribution-repositories.port';
import { Distribution } from '../../../../contexts/distribution/domain/entities/distribution.entity';
import { Dispatch } from '../../../../contexts/distribution/domain/entities/dispatch.entity';
import { DistributionWindow } from '../../../../contexts/distribution/domain/value-objects/distribution-window.vo';
import { TargetFilter } from '../../../../contexts/distribution/domain/value-objects/target-filter.vo';
import { DistributionStatus } from '../../../../contexts/distribution/domain/value-objects/distribution-status.vo';
import {
  BlockedReason,
  DispatchStatus,
} from '../../../../contexts/distribution/domain/value-objects/dispatch-status.vo';
import { ScopedRawQueryService } from '../scoped-raw-query.service';
import { DispatchOrmEntity } from '../entities/dispatch-orm.entity';
import { DistributionOrmEntity } from '../entities/distribution-orm.entity';
import { TENANT_FILTER } from '../entities/tenant-scoped-orm.entity';

/** Batch size for the plan insert: big enough to be fast, small enough not to build a 50k-row statement. */
const INSERT_CHUNK = 500;

@Injectable()
export class MikroOrmDistributionRepository implements DistributionRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<Distribution | null> {
    const orm = await this.em.findOne(DistributionOrmEntity, { id });
    return orm ? MikroOrmDistributionRepository.toDomain(orm) : null;
  }

  async list(filter: ListDistributionsFilter): Promise<PaginatedResult<Distribution>> {
    const params = Pagination.create(filter.page, filter.limit);
    const where: Record<string, unknown> = {};
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.contentId) {
      where.contentId = filter.contentId;
    }

    const [rows, total] = await this.em.findAndCount(DistributionOrmEntity, where, {
      limit: params.limit,
      offset: (params.page - 1) * params.limit,
      orderBy: { createdAt: 'DESC' },
    });

    return Pagination.createResult(
      rows.map((row) => MikroOrmDistributionRepository.toDomain(row)),
      total,
      params,
    );
  }

  async save(distribution: Distribution): Promise<Distribution> {
    await this.em.upsert(DistributionOrmEntity, {
      id: distribution.id,
      accountId: distribution.accountId,
      contentId: distribution.contentId,
      windowStart: distribution.window.start,
      windowEnd: distribution.window.end,
      status: distribution.status,
      targetFilter: distribution.targetFilter.toJson(),
      config: distribution.config,
      createdBy: distribution.createdBy,
      confirmedAt: distribution.confirmedAt,
      completedAt: distribution.completedAt,
      createdAt: distribution.createdAt,
    });
    await this.em.flush();
    return distribution;
  }

  /**
   * Job scope, not request scope: the completion sweep runs from a cron with no JWT. Same shape as the
   * channel review of FASE 2 — it returns identities only, and each job re-reads through the scoped
   * `findById` after establishing its own tenant scope.
   */
  async listActiveIds(): Promise<{ distributionId: string; accountId: string }[]> {
    const rows = await this.em.find(
      DistributionOrmEntity,
      {
        status: {
          $in: [DistributionStatus.PLANNED, DistributionStatus.RUNNING, DistributionStatus.PAUSED],
        },
      },
      { filters: { [TENANT_FILTER]: false }, fields: ['id', 'accountId'] },
    );
    return rows.map((row) => ({ distributionId: row.id, accountId: row.accountId }));
  }

  private static toDomain(orm: DistributionOrmEntity): Distribution {
    return Distribution.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      contentId: orm.contentId,
      window: DistributionWindow.create(orm.windowStart, orm.windowEnd),
      status: orm.status,
      targetFilter: TargetFilter.fromJson(orm.targetFilter),
      config: orm.config ?? {},
      createdBy: orm.createdBy,
      confirmedAt: orm.confirmedAt,
      completedAt: orm.completedAt,
      createdAt: orm.createdAt,
    });
  }
}

@Injectable()
export class MikroOrmDispatchRepository implements DispatchRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    /**
     * The three aggregate reads below are GROUP BY queries, which the ORM's query builder cannot
     * express without an alias-prefixed `count(*)` that Postgres rejects. They go through the scoped
     * raw service instead — the one authorised path for raw SQL, which refuses any statement that does
     * not carry `:accountId`. That is stricter than the global filter, not weaker.
     */
    private readonly raw: ScopedRawQueryService,
  ) {}

  async findById(id: string): Promise<Dispatch | null> {
    const orm = await this.em.findOne(DispatchOrmEntity, { id });
    return orm ? MikroOrmDispatchRepository.toDomain(orm) : null;
  }

  async saveMany(dispatches: readonly Dispatch[]): Promise<void> {
    for (let index = 0; index < dispatches.length; index += INSERT_CHUNK) {
      const chunk = dispatches.slice(index, index + INSERT_CHUNK);
      await this.em.insertMany(
        DispatchOrmEntity,
        chunk.map((dispatch) =>
          MikroOrmDispatchRepository.toOrmData(dispatch),
        ) as unknown as DispatchOrmEntity[],
      );
    }
  }

  async save(dispatch: Dispatch): Promise<Dispatch> {
    await this.em.upsert(DispatchOrmEntity, MikroOrmDispatchRepository.toOrmData(dispatch));
    await this.em.flush();
    return dispatch;
  }

  async nextPendingAt(distributionId: string): Promise<Date | null> {
    const [row] = await this.raw.scoped<{ next_at: Date | null }>(
      `select min(scheduled_at) as next_at
         from dispatches
        where account_id = :accountId
          and distribution_id = :distributionId
          and status = 'PENDING'`,
      { distributionId },
    );
    return row?.next_at ?? null;
  }

  /**
   * One grouped query instead of six counts.
   */
  async countsFor(distributionId: string): Promise<DispatchCounts> {
    const rows = await this.raw.scoped<{ status: DispatchStatus; total: string }>(
      `select status, count(*) as total
         from dispatches
        where account_id = :accountId and distribution_id = :distributionId
        group by status`,
      { distributionId },
    );

    const counts: DispatchCounts = {
      total: 0,
      pending: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
      blocked: 0,
    };
    for (const row of rows) {
      const value = Number.parseInt(row.total, 10);
      counts.total += value;
      switch (row.status) {
        case DispatchStatus.PENDING:
          counts.pending = value;
          break;
        case DispatchStatus.SENDING:
          counts.sending = value;
          break;
        case DispatchStatus.SENT:
          counts.sent = value;
          break;
        case DispatchStatus.FAILED:
          counts.failed = value;
          break;
        case DispatchStatus.CANCELLED:
          counts.cancelled = value;
          break;
        case DispatchStatus.BLOCKED:
          counts.blocked = value;
          break;
      }
    }
    return counts;
  }

  async byChannelFor(distributionId: string): Promise<DispatchesByChannel[]> {
    const rows = await this.raw.scoped<{
      channel_id: string | null;
      status: DispatchStatus;
      total: string;
    }>(
      `select channel_id, status, count(*) as total
         from dispatches
        where account_id = :accountId and distribution_id = :distributionId
        group by channel_id, status`,
      { distributionId },
    );

    const byChannel = new Map<string, DispatchesByChannel>();
    for (const row of rows) {
      const channelId = row.channel_id ?? 'sem-canal';
      const entry = byChannel.get(channelId) ?? { channelId, scheduled: 0, sent: 0, failed: 0 };
      const value = Number.parseInt(row.total, 10);
      if (row.status === DispatchStatus.SENT) {
        entry.sent += value;
      } else if (row.status === DispatchStatus.FAILED) {
        entry.failed += value;
      }
      if (row.status !== DispatchStatus.BLOCKED) {
        entry.scheduled += value;
      }
      byChannel.set(channelId, entry);
    }
    return [...byChannel.values()];
  }

  async blockedSummaryFor(distributionId: string): Promise<BlockedSummary[]> {
    const rows = await this.raw.scoped<{ blocked_reason: BlockedReason | null; total: string }>(
      `select blocked_reason, count(*) as total
         from dispatches
        where account_id = :accountId
          and distribution_id = :distributionId
          and status = 'BLOCKED'
        group by blocked_reason`,
      { distributionId },
    );

    return rows
      .filter((row) => row.blocked_reason !== null)
      .map((row) => ({
        reason: row.blocked_reason as BlockedReason,
        count: Number.parseInt(row.total, 10),
      }));
  }

  async listForDistribution(
    distributionId: string,
    filter: PaginationParams & { status?: DispatchStatus },
  ): Promise<PaginatedResult<Dispatch>> {
    const params = Pagination.create(filter.page, filter.limit);
    const where: Record<string, unknown> = { distributionId };
    if (filter.status) {
      where.status = filter.status;
    }

    const [rows, total] = await this.em.findAndCount(DispatchOrmEntity, where, {
      limit: params.limit,
      offset: (params.page - 1) * params.limit,
      orderBy: { scheduledAt: 'ASC' },
    });

    return Pagination.createResult(
      rows.map((row) => MikroOrmDispatchRepository.toDomain(row)),
      total,
      params,
    );
  }

  async cancelPendingFor(distributionId: string): Promise<number> {
    // SENT rows are untouched on purpose: cancelling preserves what already went out (§10 item 8).
    return this.em.nativeUpdate(
      DispatchOrmEntity,
      { distributionId, status: { $in: [DispatchStatus.PENDING, DispatchStatus.SENDING] } },
      { status: DispatchStatus.CANCELLED },
    );
  }

  /**
   * Claims one dispatch for a worker, atomically (§10, FASE 7 item 3).
   *
   * `FOR UPDATE SKIP LOCKED` on the SELECT, then a status change to SENDING inside the same
   * transaction. Two workers cannot both leave here with the same row: the second one's SELECT skips
   * it, and even if it somehow read it, the `status = PENDING` clause on the UPDATE would match zero
   * rows and this returns null.
   *
   * This is the only place in the distribution context that writes SQL by hand, and it is because
   * `SKIP LOCKED` has no expression in the ORM's query builder. Raw SQL does NOT see the global tenant
   * filter, so `account_id` is in the WHERE clause explicitly — the same discipline
   * ScopedRawQueryService imposes on metric queries. Relying on the dispatch id being unguessable
   * would be relying on obscurity where a WHERE clause costs nothing.
   */
  async claimDue(input: { accountId: string; dispatchId: string }): Promise<Dispatch | null> {
    return this.em.transactional(async (em) => {
      const knex = em.getKnex();
      const selected = await knex
        .select('*')
        .from('dispatches')
        .where('id', input.dispatchId)
        .andWhere('account_id', input.accountId)
        .andWhere('status', DispatchStatus.PENDING)
        .forUpdate()
        .skipLocked()
        .first();

      if (!selected) {
        return null;
      }

      const updated = await knex('dispatches')
        .where({
          id: input.dispatchId,
          account_id: input.accountId,
          status: DispatchStatus.PENDING,
        })
        .update({ status: DispatchStatus.SENDING, attempts: knex.raw('attempts + 1') })
        .returning('*');

      const row = updated[0];
      return row ? MikroOrmDispatchRepository.fromRow(row as Record<string, unknown>) : null;
    });
  }

  async findByProviderMessageId(providerMessageId: string): Promise<Dispatch | null> {
    const orm = await this.em.findOne(DispatchOrmEntity, { evolutionMessageId: providerMessageId });
    return orm ? MikroOrmDispatchRepository.toDomain(orm) : null;
  }

  async listPendingForChannel(channelId: string): Promise<Dispatch[]> {
    const rows = await this.em.find(DispatchOrmEntity, {
      channelId,
      status: DispatchStatus.PENDING,
    });
    return rows.map((row) => MikroOrmDispatchRepository.toDomain(row));
  }

  async reassignPending(input: {
    fromChannelId: string;
    reassignments: ReadonlyMap<string, string>;
  }): Promise<number> {
    // Grouped by destination channel so it is one UPDATE per target, not one per contact.
    const byTarget = new Map<string, string[]>();
    for (const [contactId, channelId] of input.reassignments) {
      const list = byTarget.get(channelId) ?? [];
      list.push(contactId);
      byTarget.set(channelId, list);
    }

    let changed = 0;
    for (const [channelId, contactIds] of byTarget) {
      changed += await this.em.nativeUpdate(
        DispatchOrmEntity,
        {
          channelId: input.fromChannelId,
          status: DispatchStatus.PENDING,
          contactId: { $in: contactIds },
        },
        { channelId },
      );
    }
    return changed;
  }

  async blockPendingForChannel(channelId: string, reason: BlockedReason): Promise<number> {
    return this.em.nativeUpdate(
      DispatchOrmEntity,
      { channelId, status: DispatchStatus.PENDING },
      { status: DispatchStatus.BLOCKED, blockedReason: reason },
    );
  }

  private static toDomain(orm: DispatchOrmEntity): Dispatch {
    return Dispatch.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      distributionId: orm.distributionId,
      contactId: orm.contactId,
      channelId: orm.channelId,
      variantId: orm.variantId,
      renderedBody: orm.renderedBody,
      scheduledAt: orm.scheduledAt,
      status: orm.status,
      blockedReason: orm.blockedReason,
      attempts: orm.attempts,
      evolutionMessageId: orm.evolutionMessageId,
      deliveryStatus: orm.deliveryStatus,
      errorDetail: orm.errorDetail,
      sentAt: orm.sentAt,
      createdAt: orm.createdAt,
    });
  }

  /** Snake-cased row from the raw claim query. */
  private static fromRow(row: Record<string, unknown>): Dispatch {
    return Dispatch.reconstitute({
      id: row.id as string,
      accountId: row.account_id as string,
      distributionId: row.distribution_id as string,
      contactId: row.contact_id as string,
      channelId: (row.channel_id as string | null) ?? null,
      variantId: (row.variant_id as string | null) ?? null,
      renderedBody: row.rendered_body as string,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at as string) : null,
      status: row.status as DispatchStatus,
      blockedReason: (row.blocked_reason as BlockedReason | null) ?? null,
      attempts: Number(row.attempts ?? 0),
      evolutionMessageId: (row.evolution_message_id as string | null) ?? null,
      deliveryStatus: (row.delivery_status as string | null) ?? null,
      errorDetail: (row.error_detail as string | null) ?? null,
      sentAt: row.sent_at ? new Date(row.sent_at as string) : null,
      createdAt: new Date(row.created_at as string),
    });
  }

  private static toOrmData(dispatch: Dispatch): Record<string, unknown> {
    return {
      id: dispatch.id,
      accountId: dispatch.accountId,
      distributionId: dispatch.distributionId,
      contactId: dispatch.contactId,
      channelId: dispatch.channelId,
      variantId: dispatch.variantId,
      renderedBody: dispatch.renderedBody,
      scheduledAt: dispatch.scheduledAt,
      status: dispatch.status,
      blockedReason: dispatch.blockedReason,
      attempts: dispatch.attempts,
      evolutionMessageId: dispatch.evolutionMessageId,
      deliveryStatus: dispatch.deliveryStatus,
      errorDetail: dispatch.errorDetail,
      sentAt: dispatch.sentAt,
      createdAt: dispatch.createdAt,
    };
  }
}
