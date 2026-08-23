import { Collection, Entity, Index, OneToMany, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';
import { PriceListItemOrmEntity } from './price-list-item-orm.entity';

/**
 * `price_lists` (§3.2 do 02A) — tabela de preço do VND. Tabela de TENANT com RLS. Vínculos opcionais
 * a contato e vendedor (as duas dimensões que a resolução usa no V1); canal/PDV são futuros.
 */
@Entity({ tableName: 'price_lists' })
export class PriceListOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 120 })
  name!: string;

  @Property()
  active = true;

  @Index()
  @Property({ type: 'uuid', nullable: true, fieldName: 'contact_id' })
  contactId: string | null = null;

  @Index()
  @Property({ type: 'uuid', nullable: true, fieldName: 'sales_rep_id' })
  salesRepId: string | null = null;

  @OneToMany(() => PriceListItemOrmEntity, (item) => item.priceList)
  items = new Collection<PriceListItemOrmEntity>(this);
}
