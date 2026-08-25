import { Cascade, Collection, Entity, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import { OrderItemOrmEntity } from './order-item-orm.entity';

@Entity({ tableName: 'orders' })
export class OrderOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  userId!: string;

  @Property({ type: 'uuid', nullable: true })
  resellerId?: string;

  @Property({ type: 'varchar', length: 100, nullable: true })
  blingOrderId?: string;

  @Property({ type: 'varchar', length: 50 })
  status!: string;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  subtotal!: number;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  shippingCost!: number;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  discount!: number;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  total!: number;

  @Property({ type: 'varchar', length: 100, nullable: true })
  shippingMethod?: string;

  @Property({ type: 'jsonb' })
  shippingAddress!: Record<string, unknown>;

  @Property({ type: 'varchar', length: 100, nullable: true })
  trackingCode?: string;

  @Property({ type: 'varchar', length: 100, nullable: true })
  paymentId?: string;

  @Property({ type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  @Property({ type: 'timestamp', nullable: true })
  paidAt?: Date;

  @Property({ type: 'timestamp', nullable: true })
  shippedAt?: Date;

  @Property({ type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  @Property({ type: 'timestamp', nullable: true })
  canceledAt?: Date;

  @Property({ type: 'text', nullable: true })
  cancelReason?: string;

  @Property({ type: 'text', nullable: true })
  notes?: string;

  @Property({ type: 'timestamp', onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ type: 'timestamp', onUpdate: () => new Date() })
  updatedAt!: Date;

  @OneToMany(() => OrderItemOrmEntity, (item) => item.order, {
    cascade: [Cascade.PERSIST, Cascade.REMOVE],
    orphanRemoval: true,
    eager: true,
  })
  items = new Collection<OrderItemOrmEntity>(this);
}
