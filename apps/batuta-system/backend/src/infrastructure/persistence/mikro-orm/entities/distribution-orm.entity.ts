import { Entity, Enum, Index, Property } from '@mikro-orm/core';
import { DistributionStatus } from '../../../../contexts/distribution/domain/value-objects/distribution-status.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** §4, `distributions`. */
@Entity({ tableName: 'distributions' })
@Index({ properties: ['accountId', 'status'] })
@Index({ properties: ['contentId'] })
export class DistributionOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'content_id' })
  contentId!: string;

  @Property({ type: 'timestamptz', fieldName: 'window_start' })
  windowStart!: Date;

  @Property({ type: 'timestamptz', fieldName: 'window_end' })
  windowEnd!: Date;

  @Enum({ items: () => DistributionStatus })
  status!: DistributionStatus;

  /** Tags and the manual variant↔tag mapping (§9.1). */
  @Property({ type: 'json', fieldName: 'target_filter' })
  targetFilter: Record<string, unknown> = {};

  /**
   * Snapshot of the scheduling rules the plan was built with.
   *
   * Persisted because the envs can change: without it, a `scheduled_at` two weeks old would be
   * unexplainable — nobody could tell whether it respected the quiet hours in force at the time.
   */
  @Property({ type: 'json' })
  config: Record<string, unknown> = {};

  @Property({ type: 'uuid', fieldName: 'created_by' })
  createdBy!: string;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'confirmed_at' })
  confirmedAt: Date | null = null;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'completed_at' })
  completedAt: Date | null = null;
}
