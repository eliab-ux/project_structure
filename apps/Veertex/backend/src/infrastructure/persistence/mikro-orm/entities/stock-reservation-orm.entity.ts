import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * `stock_reservations` — reservas de estoque (§3.9). NÃO são movimentos (o físico é só movimento);
 * são HOLDS que reduzem o disponível. Ao contrário de `stock_movements`, têm ciclo de vida
 * (active → released), então o runtime tem UPDATE aqui (liberar). Expiração é preguiçosa: a consulta
 * do disponível filtra `expires_at > now`; nada altera o `status` sem o agendador futuro.
 */
@Entity({ tableName: 'stock_reservations' })
export class StockReservationOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'company_id' })
  companyId!: string;

  @Index()
  @Property({ type: 'uuid', fieldName: 'product_id' })
  productId!: string;

  @Index()
  @Property({ type: 'uuid', nullable: true, fieldName: 'order_id' })
  orderId: string | null = null;

  @Property({ type: 'numeric', precision: 14, scale: 3 })
  quantity!: string;

  @Property({ length: 12 })
  status = 'active';

  @Property({ length: 12, nullable: true, fieldName: 'release_reason' })
  releaseReason: string | null = null;

  @Index()
  @Property({ type: 'timestamptz', fieldName: 'expires_at' })
  expiresAt!: Date;
}
