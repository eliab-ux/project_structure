import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** `stock_locations` (§2 do 03A) — localização de estoque por empresa. Tenant, RLS na migration. */
@Entity({ tableName: 'stock_locations' })
export class StockLocationOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'company_id' })
  companyId!: string;

  @Property({ length: 16 })
  kind!: string;

  @Property({ length: 120 })
  name!: string;

  @Property()
  active = true;
}
