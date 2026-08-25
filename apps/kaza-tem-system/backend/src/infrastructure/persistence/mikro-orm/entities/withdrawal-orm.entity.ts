import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'withdrawals' })
export class WithdrawalOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  resellerId!: string;

  @Property({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Property({ type: 'varchar', length: 20 })
  status!: string;

  @Property({ type: 'jsonb' })
  commissionIds: string[] = [];

  @Property({ type: 'varchar', length: 150 })
  bankName!: string;

  @Property({ type: 'varchar', length: 30 })
  bankAgency!: string;

  @Property({ type: 'varchar', length: 40 })
  bankAccount!: string;

  @Property({ type: 'varchar', length: 20, nullable: true })
  bankAccountType?: string;

  @Property({ type: 'varchar', length: 80, nullable: true })
  pixKey?: string;

  @Property({ type: 'varchar', length: 100, nullable: true })
  blingPayableId?: string;

  @Property({ type: 'timestamp', nullable: true })
  approvedAt?: Date;

  @Property({ type: 'varchar', length: 36, nullable: true })
  approvedBy?: string;

  @Property({ type: 'timestamp', nullable: true })
  paidAt?: Date;

  @Property({ type: 'timestamp', nullable: true })
  rejectedAt?: Date;

  @Property({ type: 'text', nullable: true })
  rejectedReason?: string;

  @Property({ type: 'timestamp', onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ type: 'timestamp', onUpdate: () => new Date() })
  updatedAt!: Date;
}
