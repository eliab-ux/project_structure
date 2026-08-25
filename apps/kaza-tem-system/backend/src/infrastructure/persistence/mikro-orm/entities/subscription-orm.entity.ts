import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'subscriptions' })
export class SubscriptionOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  resellerId!: string;

  @Property({ type: 'varchar', length: 100 })
  cieloRecurrenceId!: string;

  @Property({ type: 'varchar', length: 20 })
  status!: string;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Property({ type: 'date', nullable: true })
  nextBillingDate?: Date;

  @Property({ type: 'timestamp' })
  startedAt!: Date;

  @Property({ type: 'timestamp', nullable: true })
  canceledAt?: Date;

  @Property({ type: 'timestamp', onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ type: 'timestamp', onUpdate: () => new Date() })
  updatedAt!: Date;
}
