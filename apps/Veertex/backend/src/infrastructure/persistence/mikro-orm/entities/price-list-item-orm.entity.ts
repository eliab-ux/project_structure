import { Entity, Index, ManyToOne, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';
import { PriceListOrmEntity } from './price-list-orm.entity';

/**
 * `price_list_items` (§3.2 do 02A) — itens da tabela: produto, preço e o degrau (`min_quantity`).
 * Filha de TENANT com policy PRÓPRIA (RLS não segue JOIN): carrega `account_id`.
 */
@Entity({ tableName: 'price_list_items' })
export class PriceListItemOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @ManyToOne(() => PriceListOrmEntity, { fieldName: 'price_list_id', deleteRule: 'cascade' })
  priceList!: PriceListOrmEntity;

  @Index()
  @Property({ type: 'uuid', fieldName: 'product_id' })
  productId!: string;

  @Property({ type: 'numeric', precision: 14, scale: 2 })
  price!: string;

  @Property({ type: 'int', fieldName: 'min_quantity' })
  minQuantity = 1;
}
