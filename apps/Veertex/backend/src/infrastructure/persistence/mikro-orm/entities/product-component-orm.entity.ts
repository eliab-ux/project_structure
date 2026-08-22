import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * `product_components` — a composição de um kit (bundle). Tabela de TENANT, RLS na migration.
 *
 * O kit NÃO tem saldo próprio (§2.5 do 03): esta tabela só diz de QUE é feito. O disponível é
 * derivado dos componentes pelo EST. Substituição por soft-delete (runtime não tem DELETE).
 */
@Entity({ tableName: 'product_components' })
export class ProductComponentOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'parent_product_id' })
  parentProductId!: string;

  @Index()
  @Property({ type: 'uuid', fieldName: 'component_product_id' })
  componentProductId!: string;

  @Property({ type: 'numeric', precision: 14, scale: 3 })
  quantity!: string;
}
