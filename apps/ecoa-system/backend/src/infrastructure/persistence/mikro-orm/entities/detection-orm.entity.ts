import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'detection' })
@Index({ properties: ['ownerId', 'detectedAt'] })
export class DetectionOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Property({ fieldName: 'own_media_id', type: 'uuid', nullable: true })
  ownMediaId?: string | null;

  // Set when the source matched the tenant's watchlist ⇒ "highlighted".
  @Property({ fieldName: 'watched_account_id', type: 'uuid', nullable: true })
  watchedAccountId?: string | null;

  @Property({ fieldName: 'source_username', length: 255 })
  sourceUsername!: string;

  @Property({ fieldName: 'detection_type', length: 50 })
  detectionType!: string;

  @Property({ fieldName: 'detected_at' })
  detectedAt!: Date;

  @Property({ length: 500, nullable: true })
  permalink?: string | null;

  @Property()
  seen: boolean = false;
}
