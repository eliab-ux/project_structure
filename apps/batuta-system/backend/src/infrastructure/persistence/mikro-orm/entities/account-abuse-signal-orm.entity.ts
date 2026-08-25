import { Entity, Index, Property, Unique } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * Daily per-account abuse signals (BATUTA_SPEC §5, FASE 1 item 6: "persistir e expor ao contexto
 * platform"). Not in §4 — added as the symmetric counterpart of `channel_quality_snapshots`,
 * one row per account per day.
 *
 * The COUNTERS live here; the THRESHOLDS do not. Deciding when a rate means abuse is
 * DECISÃO PENDENTE (§14, item 10), so nothing in this table encodes a limit — the platform
 * screen shows the raw numbers and a human judges. Rates are computed, never stored, so a
 * changed definition never contradicts stored history.
 *
 * The source counters (sends, failures, deliveries, opt-outs) only start being produced in
 * FASE 7/8. Until then rows are legitimately zero.
 */
@Entity({ tableName: 'account_abuse_signals' })
@Unique({ properties: ['accountId', 'date'] })
@Index({ properties: ['date'] })
export class AccountAbuseSignalOrmEntity extends TenantScopedOrmEntity {
  /** Calendar day in the ACCOUNT's timezone — abuse is judged against the tenant's own day. */
  @Property({ type: 'date' })
  date!: string;

  @Property({ type: 'int', fieldName: 'sent_count' })
  sentCount: number = 0;

  @Property({ type: 'int', fieldName: 'failed_count' })
  failedCount: number = 0;

  @Property({ type: 'int', fieldName: 'delivered_count' })
  deliveredCount: number = 0;

  @Property({ type: 'int', fieldName: 'opt_out_count' })
  optOutCount: number = 0;

  @Property({ type: 'int', fieldName: 'inbound_count' })
  inboundCount: number = 0;

  /** Yesterday's send count, so a sudden volume jump is visible without a second query. */
  @Property({ type: 'int', fieldName: 'previous_day_sent_count' })
  previousDaySentCount: number = 0;
}
