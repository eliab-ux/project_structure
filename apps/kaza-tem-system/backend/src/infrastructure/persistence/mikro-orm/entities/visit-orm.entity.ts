import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'visits' })
export class VisitOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  resellerId!: string;

  @Property({ type: 'varchar', length: 128, nullable: true })
  visitorId?: string;

  @Property({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Property({ type: 'text', nullable: true })
  userAgent?: string;

  @Property({ type: 'text', nullable: true })
  referrer?: string;

  @Property({ type: 'text', nullable: true })
  pageUrl?: string;

  @Property({ type: 'timestamp', onCreate: () => new Date() })
  createdAt!: Date;
}
