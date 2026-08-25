import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'media_insight_snapshot' })
@Index({ properties: ['ownerId', 'ownMediaId', 'capturedAt'] })
export class MediaInsightSnapshotOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Property({ fieldName: 'own_media_id', type: 'uuid' })
  ownMediaId!: string;

  @Property({ fieldName: 'captured_at' })
  capturedAt!: Date;

  @Property()
  reach!: number;

  @Property()
  impressions!: number;

  @Property()
  likes!: number;

  @Property()
  comments!: number;

  @Property()
  saved!: number;

  @Property({ fieldName: 'shares_count' })
  sharesCount!: number;
}
