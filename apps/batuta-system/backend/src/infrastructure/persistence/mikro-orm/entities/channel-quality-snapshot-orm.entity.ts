import { Entity, Enum, Index, Property, Unique } from '@mikro-orm/core';
import { ThrottleDecision } from '../../../../contexts/channel/domain/value-objects/throttle-decision.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * One row per channel per day: the raw signals, the decision the throttle took, and WHY (§2.1).
 *
 * The reason is stored as text on purpose — "a decisão precisa ser auditável, não opaca". An
 * operator who finds the quota halved must be able to read the justification without asking anyone,
 * and without us having to reconstruct the thresholds that were in force that day.
 *
 * Rates are NOT stored: they are derived from the counters at read time, so a later change to how a
 * rate is defined never contradicts stored history.
 */
@Entity({ tableName: 'channel_quality_snapshots' })
@Unique({ properties: ['channelId', 'date'] })
@Index({ properties: ['accountId', 'date'] })
export class ChannelQualitySnapshotOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'channel_id' })
  channelId!: string;

  @Property({ type: 'date' })
  date!: string;

  @Property({ type: 'int', fieldName: 'sent_count' })
  sentCount: number = 0;

  @Property({ type: 'int', fieldName: 'failed_count' })
  failedCount: number = 0;

  @Property({ type: 'int', fieldName: 'delivered_count' })
  deliveredCount: number = 0;

  @Property({ type: 'int', fieldName: 'inbound_count' })
  inboundCount: number = 0;

  @Property({ type: 'int', fieldName: 'opt_out_count' })
  optOutCount: number = 0;

  @Property({ type: 'int', fieldName: 'disconnect_events' })
  disconnectEvents: number = 0;

  /** The quota the job computed for the following day. */
  @Property({ type: 'int', fieldName: 'computed_quota' })
  computedQuota!: number;

  @Enum({ items: () => ThrottleDecision })
  decision!: ThrottleDecision;

  @Property({ length: 500 })
  reason!: string;
}
