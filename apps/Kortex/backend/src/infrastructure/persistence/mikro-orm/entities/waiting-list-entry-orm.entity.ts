import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'waiting_list_entry' })
@Index({ name: 'waiting_list_entry_account_id_index', properties: ['accountId'] })
export class WaitingListEntryOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ fieldName: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Property({ fieldName: 'pre_order_id', type: 'uuid', nullable: true })
  preOrderId: string | null = null;

  @Property({ fieldName: 'fabric_id', type: 'uuid', nullable: true })
  fabricId: string | null = null;

  @Property({ fieldName: 'product_type_id', type: 'uuid', nullable: true })
  productTypeId: string | null = null;

  @Property({ fieldName: 'hours_needed', type: 'int' })
  hoursNeeded!: number;

  @Property({ fieldName: 'technical_notes', type: 'text', nullable: true })
  technicalNotes: string | null = null;

  @Property({ fieldName: 'wants_earlier' })
  wantsEarlier: boolean = false;

  /** Coluna `date`: chega como string 'AAAA-MM-DD' — ver a nota em `customer-orm.entity.ts`. */
  @Property({ fieldName: 'desired_until', type: 'date', nullable: true })
  desiredUntil: string | null = null;

  @Property({ length: 10 })
  status: string = 'waiting';

  @Property({ fieldName: 'offered_at', type: 'timestamptz', nullable: true })
  offeredAt: Date | null = null;

  @Property({ fieldName: 'customer_accepted_at', type: 'timestamptz', nullable: true })
  customerAcceptedAt: Date | null = null;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
