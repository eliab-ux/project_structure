import { Entity, Index, Property, Unique } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * A variant of a content (7 item 5).
 *
 * `created_by` and `reviewed_by` exist because every variant is written or reviewed BY A HUMAN, and 2
 * forbids automatic generation outright. These columns are what makes that checkable.
 */
@Entity({ tableName: 'content_variants' })
@Unique({ properties: ['contentId', 'label'] })
@Index({ properties: ['contentId', 'position'] })
export class ContentVariantOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'content_id' })
  contentId!: string;

  @Property({ length: 100 })
  label!: string;

  @Property({ type: 'text' })
  body!: string;

  @Property({ type: 'int' })
  position!: number;

  @Property({ type: 'uuid', fieldName: 'created_by' })
  createdBy!: string;

  /** Null until a human reviewed it. Cleared whenever the body changes. */
  @Property({ type: 'uuid', nullable: true, fieldName: 'reviewed_by' })
  reviewedBy: string | null = null;
}
