import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'commission_rules' })
export class CommissionRuleOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  minAmount!: number;

  @Property({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxAmount?: number;

  @Property({ type: 'decimal', precision: 5, scale: 2 })
  percentage!: number;

  @Property({ type: 'boolean', default: true })
  isActive!: boolean;

  @Property({ type: 'timestamp', onCreate: () => new Date() })
  createdAt!: Date;
}
