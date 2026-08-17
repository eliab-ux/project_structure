import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'cash_entry' })
@Index({ name: 'cash_entry_account_id_index', properties: ['accountId'] })
export class CashEntryOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ length: 10 })
  type!: string;

  /**
   * Coluna `date` — chega como string 'AAAA-MM-DD'. Regime de caixa: é a data em que o dinheiro
   * entrou ou saiu, e é por ela que o DRE agrupa o mês.
   */
  @Property({ fieldName: 'occurred_on', type: 'date' })
  occurredOn!: string;

  @Property({ fieldName: 'amount_cents', type: 'int' })
  amountCents!: number;

  @Property({ fieldName: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null = null;

  @Property({ fieldName: 'bank_account_id', type: 'uuid' })
  bankAccountId!: string;

  /** Só em transferência: a conta de destino. */
  @Property({ fieldName: 'counterpart_account_id', type: 'uuid', nullable: true })
  counterpartAccountId: string | null = null;

  @Property({ length: 300 })
  description!: string;

  @Property({ length: 200, nullable: true })
  payee: string | null = null;

  @Property({ fieldName: 'payment_method', length: 10, nullable: true })
  paymentMethod: string | null = null;

  /** Preenchido quando a entrada nasceu de uma reserva — a base da não-duplicação. */
  @Property({ fieldName: 'reservation_id', type: 'uuid', nullable: true })
  reservationId: string | null = null;

  @Property({ fieldName: 'created_by', type: 'uuid' })
  createdBy!: string;

  @Property({ fieldName: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null = null;

  @Property({ fieldName: 'cancelled_reason', length: 300, nullable: true })
  cancelledReason: string | null = null;

  @Property({ fieldName: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledBy: string | null = null;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
