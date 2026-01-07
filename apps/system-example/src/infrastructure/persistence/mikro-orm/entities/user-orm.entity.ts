import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'users' })
export class UserOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id: string;

  @Property({ length: 255 })
  @Unique()
  email: string;

  @Property({ length: 100 })
  name: string;

  @Property()
  createdAt: Date;

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date;

  @Property()
  isActive: boolean = true;
}
