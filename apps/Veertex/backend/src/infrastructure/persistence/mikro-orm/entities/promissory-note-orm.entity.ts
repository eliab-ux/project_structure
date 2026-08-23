import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** `promissory_notes` (§3.1 do 04) — 1 por pedido; o dado que a térmica imprime. Tenant, RLS. */
@Entity({ tableName: 'promissory_notes' })
export class PromissoryNoteOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'order_id' })
  orderId!: string;

  @Property({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Property({ type: 'text', fieldName: 'amount_in_words' })
  amountInWords!: string;

  @Property({ length: 200, fieldName: 'debtor_name' })
  debtorName!: string;

  @Property({ length: 14, nullable: true, fieldName: 'debtor_document' })
  debtorDocument: string | null = null;

  @Property({ type: 'text', nullable: true, fieldName: 'debtor_address' })
  debtorAddress: string | null = null;

  @Property({ type: 'timestamptz', fieldName: 'due_date' })
  dueDate!: Date;
}
