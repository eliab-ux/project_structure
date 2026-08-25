import { Entity, Enum, Index, Property } from '@mikro-orm/core';
import { MessageDirection } from '../../../../contexts/inbox/domain/value-objects/conversation-status.vo';
import { MessageKind } from '../../../../contexts/inbox/domain/value-objects/message-kind.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * §4, `messages`.
 *
 * `channel_id` per row, never rewritten by a migration (§6.4 item 6): the conversation moves to the new
 * chip, each message keeps the number it actually travelled on.
 *
 * Second of the two tables §4 flags as fast-growing. Same note as `dispatches`: partitioning by month on
 * `occurred_at` may become necessary, and doing it later needs the partition key in the primary key.
 */
@Entity({ tableName: 'messages' })
@Index({ properties: ['conversationId', 'occurredAt'] })
@Index({ properties: ['accountId', 'occurredAt'] })
@Index({ properties: ['channelId', 'direction', 'occurredAt'] })
export class MessageOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'conversation_id' })
  conversationId!: string;

  @Property({ type: 'uuid', fieldName: 'contact_id' })
  contactId!: string;

  @Property({ type: 'uuid', fieldName: 'channel_id' })
  channelId!: string;

  @Enum({ items: () => MessageDirection })
  direction!: MessageDirection;

  @Enum({ items: () => MessageKind })
  kind!: MessageKind;

  @Property({ type: 'text', nullable: true })
  body: string | null = null;

  /** Key in the tenant bucket. Media is downloaded at ingestion (§10.2 item 2), never linked. */
  @Property({ length: 500, nullable: true, fieldName: 'media_storage_key' })
  mediaStorageKey: string | null = null;

  @Property({ length: 120, nullable: true, fieldName: 'evolution_message_id' })
  evolutionMessageId: string | null = null;

  @Property({ length: 40, nullable: true, fieldName: 'delivery_status' })
  deliveryStatus: string | null = null;

  /** Set when this outbound message came from a distribution. */
  @Property({ type: 'uuid', nullable: true, fieldName: 'dispatch_id' })
  dispatchId: string | null = null;

  /** The operator who sent a reply (§10.3 item 5). Null for inbound and for campaign messages. */
  @Property({ type: 'uuid', nullable: true, fieldName: 'sent_by' })
  sentBy: string | null = null;

  @Property({ type: 'timestamptz', fieldName: 'occurred_at' })
  occurredAt!: Date;
}
