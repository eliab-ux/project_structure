import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'commissions' })
export class CommissionOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  resellerId!: string;

  @Property({ type: 'uuid' })
  orderId!: string;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  orderTotal!: number;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  commissionBase!: number;

  @Property({ type: 'decimal', precision: 5, scale: 2 })
  percentage!: number;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Property({ type: 'varchar', length: 50 })
  status!: string;

  @Property({ type: 'timestamp' })
  availableAt!: Date;

  @Property({ type: 'timestamp', nullable: true })
  withdrawnAt?: Date;

  @Property({ type: 'uuid', nullable: true })
  withdrawalId?: string;

  @Property({ type: 'timestamp', nullable: true })
  reversedAt?: Date;

  @Property({ type: 'timestamp', nullable: true })
  debtAt?: Date;

  @Property({ type: 'timestamp', onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ type: 'timestamp', onUpdate: () => new Date() })
  updatedAt!: Date;
}
