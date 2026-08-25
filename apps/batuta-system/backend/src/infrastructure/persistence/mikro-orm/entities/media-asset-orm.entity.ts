import { Entity, Enum, Index, Property } from '@mikro-orm/core';
import { MediaKind } from '../../../../contexts/content/domain/value-objects/media-kind.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

@Entity({ tableName: 'media_assets' })
@Index({ properties: ['contentId'] })
export class MediaAssetOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'content_id' })
  contentId!: string;

  /** Null → belongs to the content itself rather than to one variant. */
  @Property({ type: 'uuid', nullable: true, fieldName: 'variant_id' })
  variantId: string | null = null;

  @Enum({ items: () => MediaKind })
  kind!: MediaKind;

  /** Object key in the account MinIO bucket. Part of the content hash. */
  @Property({ length: 500, fieldName: 'storage_key' })
  storageKey!: string;

  @Property({ length: 120, fieldName: 'mime_type' })
  mimeType!: string;

  @Property({ type: 'bigint', fieldName: 'size_bytes' })
  sizeBytes!: number;

  @Property({ length: 300, fieldName: 'original_name' })
  originalName!: string;
}
