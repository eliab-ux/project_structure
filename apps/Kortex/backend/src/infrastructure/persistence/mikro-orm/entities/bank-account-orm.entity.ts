import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'bank_account' })
@Index({ name: 'bank_account_account_id_index', properties: ['accountId'] })
@Unique({ name: 'bank_account_account_id_name_unique', properties: ['accountId', 'name'] })
export class BankAccountOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ length: 120 })
  name!: string;

  @Property({ length: 120, nullable: true })
  bank: string | null = null;

  /** Saldo, não preço: pode ser zero e pode ficar negativo com a movimentação. */
  @Property({ fieldName: 'opening_balance_cents', type: 'int' })
  openingBalanceCents: number = 0;

  @Property({ fieldName: 'is_active' })
  isActive: boolean = true;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
