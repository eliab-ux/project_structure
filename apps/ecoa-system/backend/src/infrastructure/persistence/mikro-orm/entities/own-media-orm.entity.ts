import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'own_media' })
@Unique({ properties: ['ownerId', 'igMediaId'] })
@Index({ properties: ['ownerId', 'publishedAt'] })
export class OwnMediaOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Property({ fieldName: 'ig_media_id', length: 255 })
  igMediaId!: string;

  @Property({ length: 500 })
  permalink!: string;

  @Property({ fieldName: 'media_type', length: 50 })
  mediaType!: string;

  @Property({ type: 'text', nullable: true })
  caption?: string | null;

  @Property({ fieldName: 'thumbnail_url', length: 1000, nullable: true })
  thumbnailUrl?: string | null;

  @Property({ fieldName: 'published_at' })
  publishedAt!: Date;
}
