import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { ProductOrmEntity } from './product-orm.entity';

@Entity({ tableName: 'product_images' })
export class ProductImageOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => ProductOrmEntity)
  product!: ProductOrmEntity;

  @Property({ type: 'text' })
  url!: string;

  @Property({ type: 'int', default: 0 })
  position: number = 0;

  @Property({ type: 'boolean', default: false })
  isPrimary: boolean = false;

  @Property({ type: 'timestamp', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
