import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'coupons' })
export class CouponOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'varchar', length: 50, unique: true })
  @Index()
  code!: string;

  @Property({ type: 'uuid', nullable: true })
  @Index()
  resellerId?: string | null;

  @Property({ type: 'varchar', length: 20 })
  discountType!: string;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  discountValue!: number;

  @Property({ type: 'timestamp' })
  validFrom!: Date;

  @Property({ type: 'timestamp' })
  validUntil!: Date;

  @Property({ type: 'int', nullable: true })
  usageLimit?: number | null;

  @Property({ type: 'int' })
  usageCount: number = 0;

  @Property()
  isActive: boolean = true;

  @Property({ type: 'timestamp', onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ type: 'timestamp', onUpdate: () => new Date() })
  updatedAt!: Date;
}
