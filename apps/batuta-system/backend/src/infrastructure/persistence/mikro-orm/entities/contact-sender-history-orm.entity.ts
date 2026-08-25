import { Entity, Enum, Index, Property } from '@mikro-orm/core';
import { AllocationReason } from '../../../../contexts/audience/domain/value-objects/allocation-reason.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * Which number spoke to this person, and when (4).
 *
 * The spec is explicit about why it exists: "Nunca sobrescreva current_channel_id sem gravar aqui.
 * Precisa responder 'qual número falou com esta pessoa em março?' para auditoria e suporte."
 *
 * Append-only in practice: a row is written on allocation and only ever CLOSED (released_at) when the
 * contact moves. Nothing rewrites history.
 */
@Entity({ tableName: 'contact_sender_history' })
@Index({ properties: ['contactId', 'assignedAt'] })
@Index({ properties: ['channelId'] })
export class ContactSenderHistoryOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'contact_id' })
  contactId!: string;

  @Property({ type: 'uuid', fieldName: 'channel_id' })
  channelId!: string;

  @Property({ fieldName: 'assigned_at' })
  assignedAt: Date = new Date();

  /** Null while this is the current sender. */
  @Property({ type: 'timestamptz', nullable: true, fieldName: 'released_at' })
  releasedAt: Date | null = null;

  @Enum({ items: () => AllocationReason })
  reason!: AllocationReason;

  /** Set when reason = MIGRATION, so the row points at the approved migration that caused it. */
  @Property({ type: 'uuid', nullable: true, fieldName: 'migration_id' })
  migrationId: string | null = null;
}
