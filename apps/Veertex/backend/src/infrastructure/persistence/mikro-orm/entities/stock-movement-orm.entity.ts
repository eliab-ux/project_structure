import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * `stock_movements` — o movimento de estoque (EST). Tabela de TENANT, RLS na migration.
 *
 * **Append-only por natureza (§2.7 do 03):** o runtime não tem DELETE (invariante do
 * `verify:isolation`), e o EST nunca faz UPDATE de movimento — estorno é movimento novo. O saldo é
 * derivado por `SUM()` destes registros (§3.1), então não há tabela de saldo para manter em sincronia.
 */
@Entity({ tableName: 'stock_movements' })
export class StockMovementOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'company_id' })
  companyId!: string;

  @Index()
  @Property({ type: 'uuid', fieldName: 'product_id' })
  productId!: string;

  @Property({ length: 30 })
  type!: string;

  /** Magnitude para in/out; com sinal para `inventory_adjust`. */
  @Property({ type: 'numeric', precision: 14, scale: 3, fieldName: 'signed_quantity' })
  signedQuantity!: string;

  @Property({ type: 'numeric', precision: 14, scale: 4, nullable: true, fieldName: 'unit_cost' })
  unitCost: string | null = null;

  @Property({ type: 'uuid', nullable: true, fieldName: 'related_movement_id' })
  relatedMovementId: string | null = null;

  @Property({ fieldName: 'used_fallback' })
  usedFallback = false;

  @Property({ type: 'text', nullable: true })
  note: string | null = null;

  @Index()
  @Property({ type: 'timestamptz', fieldName: 'occurred_at' })
  occurredAt: Date = new Date();
}
