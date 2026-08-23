import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * `sales_targets` (§2 do 02A) — meta de venda por vendedor × período (`YYYY-MM`). Tenant, RLS.
 * Único por `(account_id, user_id, period)`.
 */
@Entity({ tableName: 'sales_targets' })
export class SalesTargetOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'user_id' })
  userId!: string;

  @Property({ length: 7 })
  period!: string;

  @Property({ type: 'numeric', precision: 14, scale: 2, fieldName: 'target_value' })
  targetValue!: string;
}
