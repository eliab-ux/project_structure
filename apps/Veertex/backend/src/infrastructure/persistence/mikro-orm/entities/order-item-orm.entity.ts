import { Entity, Index, ManyToOne, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';
import { OrderOrmEntity } from './order-orm.entity';

/**
 * `order_items` — linhas do pedido. Tabela de TENANT com policy PRÓPRIA: RLS não segue JOIN, então
 * a filha carrega `account_id` e tem policy sua, como as filhas de Contato/Produto.
 */
@Entity({ tableName: 'order_items' })
export class OrderItemOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @ManyToOne(() => OrderOrmEntity, { fieldName: 'order_id', deleteRule: 'cascade' })
  order!: OrderOrmEntity;

  @Index()
  @Property({ type: 'uuid', fieldName: 'product_id' })
  productId!: string;

  /** Snapshot do nome do produto no momento da venda — o pedido não muda se o produto for renomeado. */
  @Property({ length: 200 })
  description!: string;

  @Property({ type: 'numeric', precision: 14, scale: 3 })
  quantity!: string;

  @Property({ type: 'numeric', precision: 14, scale: 2, fieldName: 'unit_price' })
  unitPrice!: string;

  @Property({ type: 'numeric', precision: 5, scale: 2, fieldName: 'discount_percent' })
  discountPercent = '0';

  @Property({ type: 'numeric', precision: 14, scale: 2, fieldName: 'discount_value' })
  discountValue = '0';
}
