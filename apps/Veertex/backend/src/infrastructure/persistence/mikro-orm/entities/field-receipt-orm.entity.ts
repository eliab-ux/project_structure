import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * `field_receipts` (§3.2/§3.3 do 04) — recebimento em campo, DOIS ESTÁGIOS: `proposto` (campo
 * lança) → `efetivado` (retaguarda baixa no FIN). `inside_wallet=false` = "outros recebimentos".
 */
@Entity({ tableName: 'field_receipts' })
export class FieldReceiptOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'trip_id' })
  tripId!: string;

  @Index()
  @Property({ type: 'uuid', nullable: true, fieldName: 'title_id' })
  titleId: string | null = null;

  @Property({ length: 12 })
  method!: string;

  @Property({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Property({ type: 'numeric', precision: 14, scale: 2 })
  interest = '0';

  @Property({ fieldName: 'inside_wallet' })
  insideWallet = true;

  @Index()
  @Property({ length: 12 })
  status = 'proposto';

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'effectuated_at' })
  effectuatedAt: Date | null = null;
}
