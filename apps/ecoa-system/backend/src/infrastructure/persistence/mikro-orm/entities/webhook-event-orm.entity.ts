import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';

/**
 * Dedup + audit of inbound Meta webhook deliveries (and reconcile-mention ingestions). Meta may
 * redeliver the same event; the unique `external_id` makes reprocessing a no-op. `resolved_owner_id`
 * is null when the event's ig_user_id matched no connection (orphan → discarded).
 */
@Entity({ tableName: 'webhook_event' })
export class WebhookEventOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'external_id', length: 255 })
  @Unique()
  externalId!: string;

  @Property({ fieldName: 'resolved_owner_id', type: 'uuid', nullable: true })
  resolvedOwnerId?: string | null;

  @Property({ fieldName: 'payload_hash', length: 64 })
  payloadHash!: string;

  @Property({ fieldName: 'received_at' })
  receivedAt: Date = new Date();

  @Property()
  processed: boolean = false;
}
