import { Entity, Enum, Index, Property, Unique } from '@mikro-orm/core';
import { ChannelStatus } from '../../../../contexts/channel/domain/value-objects/channel-status.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

@Entity({ tableName: 'channels' })
@Unique({ properties: ['accountId', 'phoneE164'] })
@Index({ properties: ['accountId', 'status'] })
export class ChannelOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 120 })
  label!: string;

  /** E.164 with the leading plus. Unique per account: one chip is one channel. */
  @Property({ length: 20, fieldName: 'phone_e164' })
  phoneE164!: string;

  /** `acct-{account_id}-ch-{channel_id}`; globally unique so tenants cannot collide on a shared server. */
  @Unique()
  @Property({ length: 120, fieldName: 'evolution_instance_name' })
  evolutionInstanceName!: string;

  @Enum({ items: () => ChannelStatus })
  status!: ChannelStatus;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'warmup_started_at' })
  warmupStartedAt: Date | null = null;

  /** Adjusted ONLY by the daily throttle job — never editable from the UI (§2.1). */
  @Property({ type: 'int', fieldName: 'current_quota' })
  currentQuota!: number;

  /** Operator-owned bounds of the band. */
  @Property({ type: 'int', fieldName: 'quota_floor' })
  quotaFloor!: number;

  @Property({ type: 'int', fieldName: 'quota_ceiling' })
  quotaCeiling!: number;

  @Property({ type: 'int', fieldName: 'consecutive_failures' })
  consecutiveFailures: number = 0;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'last_send_at' })
  lastSendAt: Date | null = null;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'last_quota_review_at' })
  lastQuotaReviewAt: Date | null = null;

  /**
   * Running count for the current day, reset by the daily review after it is snapshotted.
   * Kept on the channel (not derived) because the webhook is the only source of this signal and it
   * arrives asynchronously.
   */
  @Property({ type: 'int', fieldName: 'disconnect_events_today' })
  disconnectEventsToday: number = 0;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'last_disconnect_at' })
  lastDisconnectAt: Date | null = null;

  /** Set together with BANNED or RETIRED — both terminal, both human-declared (§4). */
  @Property({ type: 'timestamptz', nullable: true, fieldName: 'retired_at' })
  retiredAt: Date | null = null;

  @Property({ type: 'uuid', nullable: true, fieldName: 'retired_by' })
  retiredBy: string | null = null;

  @Property({ length: 500, nullable: true, fieldName: 'terminal_reason' })
  terminalReason: string | null = null;
}
