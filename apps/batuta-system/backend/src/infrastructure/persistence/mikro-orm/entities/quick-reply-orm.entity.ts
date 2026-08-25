import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** §4, `quick_replies`. */
@Entity({ tableName: 'quick_replies' })
@Index({ properties: ['accountId'] })
export class QuickReplyOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 120 })
  title!: string;

  @Property({ type: 'text' })
  body!: string;

  @Property({ type: 'json' })
  tags: string[] = [];

  @Property({ type: 'uuid', fieldName: 'created_by' })
  createdBy!: string;

  /** So the library can be ordered by what actually gets used. */
  @Property({ type: 'int', fieldName: 'usage_count' })
  usageCount: number = 0;
}
