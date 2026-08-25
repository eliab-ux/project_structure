import { Entity, Enum, Index, Property } from '@mikro-orm/core';
import {
  MigrationStatus,
  MigrationStrategy,
} from '../../../../contexts/audience/domain/value-objects/migration-strategy.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

@Entity({ tableName: 'sender_migrations' })
@Index({ properties: ['accountId', 'createdAt'] })
export class SenderMigrationOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'from_channel_id' })
  fromChannelId!: string;

  @Enum({ items: () => MigrationStrategy })
  strategy!: MigrationStrategy;

  /** Null for REDISTRIBUTE: the distribution is computed, not chosen. */
  @Property({ type: 'uuid', nullable: true, fieldName: 'to_channel_id' })
  toChannelId: string | null = null;

  @Property({ type: 'int', fieldName: 'contacts_affected' })
  contactsAffected: number = 0;

  @Property({ type: 'uuid', fieldName: 'requested_by' })
  requestedBy!: string;

  /** 6.4 item 4 requires a recorded human approval. */
  @Property({ type: 'uuid', fieldName: 'approved_by' })
  approvedBy!: string;

  @Enum({ items: () => MigrationStatus })
  status!: MigrationStatus;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'executed_at' })
  executedAt: Date | null = null;

  @Property({ length: 500, nullable: true, fieldName: 'failure_reason' })
  failureReason: string | null = null;
}
