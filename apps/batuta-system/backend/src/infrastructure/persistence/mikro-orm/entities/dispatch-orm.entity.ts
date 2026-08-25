import { Entity, Enum, Index, Property } from '@mikro-orm/core';
import {
  BlockedReason,
  DispatchStatus,
} from '../../../../contexts/distribution/domain/value-objects/dispatch-status.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * §4, `dispatches`. One row per contact per distribution.
 *
 * The indexes are the ones §4 names, and they are not decoration: the worker's claim query filters by
 * (status, scheduled_at), the panel groups by (distribution_id, status), and the migration re-point of
 * §6.4 walks (channel_id, scheduled_at).
 *
 * §4 also flags the growth: this table and `messages` are the two that get big. Partitioning by month
 * on `scheduled_at` may become necessary, and doing it later requires the partition key in the primary
 * key — which is why that note lives here, next to the PK, rather than in a document.
 */
@Entity({ tableName: 'dispatches' })
@Index({ properties: ['accountId', 'status', 'scheduledAt'] })
@Index({ properties: ['channelId', 'scheduledAt'] })
@Index({ properties: ['distributionId', 'status'] })
@Index({ properties: ['contactId', 'sentAt'] })
export class DispatchOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'distribution_id' })
  distributionId!: string;

  @Property({ type: 'uuid', fieldName: 'contact_id' })
  contactId!: string;

  /** Nullable only for a BLOCKED row whose sender vanished entirely. */
  @Property({ type: 'uuid', nullable: true, fieldName: 'channel_id' })
  channelId: string | null = null;

  /** Null means the content's base body — not "no body". */
  @Property({ type: 'uuid', nullable: true, fieldName: 'variant_id' })
  variantId: string | null = null;

  /** The FINAL text, merge fields resolved. The audit evidence (§4). */
  @Property({ type: 'text', fieldName: 'rendered_body' })
  renderedBody!: string;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'scheduled_at' })
  scheduledAt: Date | null = null;

  @Enum({ items: () => DispatchStatus })
  status!: DispatchStatus;

  @Enum({ items: () => BlockedReason, nullable: true, fieldName: 'blocked_reason' })
  blockedReason: BlockedReason | null = null;

  @Property({ type: 'int' })
  attempts: number = 0;

  @Property({ length: 120, nullable: true, fieldName: 'evolution_message_id' })
  evolutionMessageId: string | null = null;

  /** Provider ack: what feeds `delivery_rate`, which drives the throttle (§2.1). */
  @Property({ length: 40, nullable: true, fieldName: 'delivery_status' })
  deliveryStatus: string | null = null;

  @Property({ length: 500, nullable: true, fieldName: 'error_detail' })
  errorDetail: string | null = null;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'sent_at' })
  sentAt: Date | null = null;
}
