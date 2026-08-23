import { Entity, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * `commission_a_tiers` (§2 do 02A) — faixas do Modelo A, por conta. Tenant, RLS. Config substituída
 * em bloco: a troca faz soft-delete das antigas e insere as novas (runtime não tem DELETE).
 */
@Entity({ tableName: 'commission_a_tiers' })
export class CommissionATierOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'numeric', precision: 8, scale: 2, fieldName: 'threshold_percent' })
  thresholdPercent!: string;

  @Property({ type: 'numeric', precision: 6, scale: 2, fieldName: 'commission_percent' })
  commissionPercent!: string;
}
