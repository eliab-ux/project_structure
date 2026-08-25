import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { OrderOrmEntity } from './order-orm.entity';

@Entity({ tableName: 'order_items' })
export class OrderItemOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => OrderOrmEntity, { nullable: false })
  order!: OrderOrmEntity;

  @Property({ type: 'uuid' })
  productId!: string;

  @Property({ type: 'varchar', length: 100 })
  sku!: string;

  @Property({ type: 'varchar', length: 255 })
  name!: string;

  @Property({ type: 'int' })
  quantity!: number;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice!: number;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice!: number;

  @Property({ type: 'timestamp', onCreate: () => new Date() })
  createdAt!: Date;
}
