import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'materials' })
export class MaterialOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'varchar', length: 255 })
  title!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'varchar', length: 20 })
  type!: string;

  @Property({ type: 'text' })
  fileUrl!: string;

  @Property({ type: 'text', nullable: true })
  thumbnailUrl?: string;

  @Property({ type: 'boolean', default: true })
  isActive!: boolean;

  @Property({ type: 'timestamp', onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ type: 'timestamp', onUpdate: () => new Date() })
  updatedAt!: Date;
}
