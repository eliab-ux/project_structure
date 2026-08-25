import {
  Cascade,
  Collection,
  Entity,
  Index,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { ProductImageOrmEntity } from './product-image-orm.entity';

@Entity({ tableName: 'products' })
export class ProductOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'varchar', length: 100, unique: true })
  @Index()
  sku!: string;

  @Property({ type: 'varchar', length: 255 })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Property({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  costPrice?: number;

  @Property({ type: 'int' })
  stock!: number;

  @Property({ type: 'decimal', precision: 8, scale: 3, nullable: true })
  weight?: number;

  @Property({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  width?: number;

  @Property({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  height?: number;

  @Property({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  length?: number;

  @Property({ type: 'varchar', length: 100, nullable: true, name: 'category_name' })
  @Index()
  categoryName?: string;

  @Property({ type: 'boolean', default: true })
  isActive!: boolean;

  @Property({ type: 'timestamp', onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ type: 'timestamp', onUpdate: () => new Date() })
  updatedAt!: Date;

  @OneToMany(() => ProductImageOrmEntity, (image) => image.product, {
    cascade: [Cascade.ALL],
    orphanRemoval: true,
    orderBy: { position: 'ASC' },
  })
  images = new Collection<ProductImageOrmEntity>(this);
}
