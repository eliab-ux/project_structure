import { Entity, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** `commission_b_tiers` (§2.2 do 02A) — faixas do Modelo B, por conta. Mesma mecânica das do A. */
@Entity({ tableName: 'commission_b_tiers' })
export class CommissionBTierOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'numeric', precision: 8, scale: 2, fieldName: 'threshold_percent' })
  thresholdPercent!: string;

  @Property({ type: 'numeric', precision: 6, scale: 2, fieldName: 'commission_percent' })
  commissionPercent!: string;
}
