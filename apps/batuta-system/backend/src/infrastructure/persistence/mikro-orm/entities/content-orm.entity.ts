import { Entity, Enum, Index, Property } from '@mikro-orm/core';
import { ContentClassification } from '../../../../contexts/content/domain/value-objects/content-classification.vo';
import { ContentOrigin } from '../../../../contexts/content/domain/value-objects/content-origin.vo';
import { ContentStatus } from '../../../../contexts/content/domain/value-objects/content-status.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

@Entity({ tableName: 'contents' })
@Index({ properties: ['accountId', 'status'] })
@Index({ properties: ['accountId', 'classification'] })
export class ContentOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 200 })
  title!: string;

  /** NOT NULL and no default: every content is born classified (1.3). */
  @Enum({ items: () => ContentClassification })
  classification!: ContentClassification;

  @Enum({ items: () => ContentOrigin })
  origin!: ContentOrigin;

  @Property({ type: 'text', fieldName: 'body_base' })
  bodyBase!: string;

  /** The Instagram permalink, for example. Nothing in the system fetches it. */
  @Property({ length: 500, nullable: true, fieldName: 'source_url' })
  sourceUrl: string | null = null;

  /**
   * Off (the default) the link is provenance and only the approver sees it; on, it is appended to the
   * message the contact receives — and then it counts towards `content_hash`.
   */
  @Property({ type: 'boolean', fieldName: 'include_source_url', default: false })
  includeSourceUrl: boolean = false;

  @Enum({ items: () => ContentStatus })
  status!: ContentStatus;

  /** sha256 of body + variants + media references. Base of the approval invalidation (8.5). */
  @Property({ length: 64, fieldName: 'content_hash' })
  contentHash!: string;

  @Property({ type: 'uuid', fieldName: 'created_by' })
  createdBy!: string;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'approved_at' })
  approvedAt: Date | null = null;
}
