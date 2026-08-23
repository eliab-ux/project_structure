import { Collection, Entity, Index, OneToMany, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';
import { OrderItemOrmEntity } from './order-item-orm.entity';

/**
 * `orders` — o pedido de venda (VND). Tabela de TENANT (estende `TenantScopedOrmEntity`), RLS na
 * migration. Numeração POR empresa (§2.6): `(company_id, number)` é único por conta.
 */
@Entity({ tableName: 'orders' })
export class OrderOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'company_id' })
  companyId!: string;

  @Index()
  @Property({ type: 'uuid', fieldName: 'contact_id' })
  contactId!: string;

  /** Vendedor (base da carteirização e da comissão futura). */
  @Index()
  @Property({ type: 'uuid', nullable: true, fieldName: 'sales_rep_id' })
  salesRepId: string | null = null;

  @Property({ type: 'int' })
  number!: number;

  @Property({ length: 20 })
  origin!: string;

  /** Modo de entrega (§3.1 do 02A). Default `retirada`. */
  @Property({ length: 20, fieldName: 'delivery_mode' })
  deliveryMode = 'retirada';

  /** Granularidade fina de origem que o enum canônico não guarda (ex.: "telefone"). */
  @Property({ type: 'text', nullable: true, fieldName: 'origin_detail' })
  originDetail: string | null = null;

  @Index()
  @Property({ length: 20 })
  status!: string;

  @Property({ type: 'numeric', precision: 5, scale: 2, fieldName: 'discount_percent' })
  discountPercent = '0';

  @Property({ type: 'numeric', precision: 14, scale: 2, fieldName: 'discount_value' })
  discountValue = '0';

  @Property({ type: 'text', nullable: true })
  notes: string | null = null;

  /** Data de referência para "vendas do período" (§2.7) — pode diferir da criação. */
  @Property({ type: 'timestamptz', fieldName: 'reference_date' })
  referenceDate: Date = new Date();

  /** Validade do orçamento (§3.3 do 02A) — só faz sentido no estágio `orcamento`; opcional. */
  @Property({ type: 'timestamptz', nullable: true, fieldName: 'valid_until' })
  validUntil: Date | null = null;

  @OneToMany(() => OrderItemOrmEntity, (item) => item.order)
  items = new Collection<OrderItemOrmEntity>(this);
}
