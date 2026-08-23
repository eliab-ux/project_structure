import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * `order_evidences` (§3.1 do 04) — GPS/fotos do pedido consignado, **append-only** (grant sem
 * update/delete): o GPS é imutável; alteração é linha NOVA apontando a anterior, com quem/quando.
 */
@Entity({ tableName: 'order_evidences' })
export class OrderEvidenceOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'order_id' })
  orderId!: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'trip_id' })
  tripId: string | null = null;

  @Property({ length: 20 })
  type!: string;

  @Property({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  latitude: string | null = null;

  @Property({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  longitude: string | null = null;

  /** Chave do objeto no storage (a URL é montada na leitura, nunca persistida). */
  @Property({ length: 300, nullable: true, fieldName: 'object_key' })
  objectKey: string | null = null;

  @Property({ type: 'uuid', nullable: true, fieldName: 'previous_evidence_id' })
  previousEvidenceId: string | null = null;

  @Property({ type: 'uuid', nullable: true, fieldName: 'changed_by_user_id' })
  changedByUserId: string | null = null;

  @Property({ type: 'text', nullable: true, fieldName: 'change_reason' })
  changeReason: string | null = null;

  @Property({ type: 'timestamptz', fieldName: 'captured_at' })
  capturedAt: Date = new Date();
}
