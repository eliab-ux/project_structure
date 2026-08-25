import { Entity, Enum, Index, Property, Unique } from '@mikro-orm/core';
import {
  ConversationPriority,
  ConversationStatus,
} from '../../../../contexts/inbox/domain/value-objects/conversation-status.vo';
import { IntentClass } from '../../../../contexts/inbox/domain/value-objects/intent-class.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * §4, `conversations`. Unique on (account_id, contact_id) — the database enforcing §10.1's
 * one-item-per-contact rule, so a race between two inbound webhooks cannot create a second thread.
 */
@Entity({ tableName: 'conversations' })
@Unique({ properties: ['accountId', 'contactId'] })
@Index({ properties: ['accountId', 'status', 'priority'] })
@Index({ properties: ['channelId'] })
export class ConversationOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'contact_id' })
  contactId!: string;

  @Property({ type: 'uuid', fieldName: 'channel_id' })
  channelId!: string;

  @Enum({ items: () => ConversationStatus })
  status!: ConversationStatus;

  @Enum({ items: () => ConversationPriority })
  priority!: ConversationPriority;

  @Enum({ items: () => IntentClass, nullable: true, fieldName: 'intent_class' })
  intentClass: IntentClass | null = null;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'last_inbound_at' })
  lastInboundAt: Date | null = null;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'last_outbound_at' })
  lastOutboundAt: Date | null = null;

  @Property({ type: 'uuid', nullable: true, fieldName: 'locked_by' })
  lockedBy: string | null = null;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'locked_at' })
  lockedAt: Date | null = null;

  @Property({ type: 'int', fieldName: 'unread_count' })
  unreadCount: number = 0;

  @Property({ type: 'uuid', nullable: true, fieldName: 'resolved_by' })
  resolvedBy: string | null = null;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'resolved_at' })
  resolvedAt: Date | null = null;
}
