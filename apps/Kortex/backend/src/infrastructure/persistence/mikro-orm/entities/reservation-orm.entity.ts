import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'reservation' })
@Index({ name: 'reservation_account_id_index', properties: ['accountId'] })
export class ReservationOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  /** 1:1 com o compromisso `machine_hour` (§4.9). */
  @Property({ fieldName: 'schedule_entry_id', type: 'uuid' })
  @Unique({ name: 'reservation_schedule_entry_id_unique' })
  scheduleEntryId!: string;

  @Property({ fieldName: 'pre_order_id', type: 'uuid' })
  preOrderId!: string;

  @Property({ fieldName: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Property({ fieldName: 'machine_id', type: 'uuid' })
  machineId!: string;

  @Property({ type: 'int' })
  hours!: number;

  /** SNAPSHOT do preço da máquina no dia da venda (decisão 2.9). Não muda depois. */
  @Property({ fieldName: 'hour_price_cents', type: 'int' })
  hourPriceCents!: number;

  @Property({ fieldName: 'total_cents', type: 'int' })
  totalCents!: number;

  @Property({ length: 15 })
  status: string = 'pre_reserved';

  @Property({ fieldName: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null = null;

  @Property({ fieldName: 'payment_method', length: 10, nullable: true })
  paymentMethod: string | null = null;

  @Property({ fieldName: 'paid_registered_by', type: 'uuid', nullable: true })
  paidRegisteredBy: string | null = null;

  @Property({ fieldName: 'no_show_at', type: 'timestamptz', nullable: true })
  noShowAt: Date | null = null;

  @Property({ fieldName: 'no_show_resolution', length: 15, nullable: true })
  noShowResolution: string | null = null;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
