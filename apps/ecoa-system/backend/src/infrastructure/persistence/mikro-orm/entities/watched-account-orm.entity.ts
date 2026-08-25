import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'watched_account' })
@Unique({ properties: ['ownerId', 'handle'] })
export class WatchedAccountOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid', fieldName: 'owner_id' })
  ownerId!: string;

  @Property({ length: 30 })
  handle!: string;

  @Property({ fieldName: 'ig_user_id', length: 64, nullable: true })
  igUserId?: string | null;

  @Property()
  active: boolean = true;

  @Property({ fieldName: 'added_at' })
  addedAt: Date = new Date();
}
