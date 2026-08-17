import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'financial_category' })
@Index({ name: 'financial_category_account_id_index', properties: ['accountId'] })
@Unique({ name: 'financial_category_unique', properties: ['accountId', 'direction', 'name'] })
export class FinancialCategoryOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ length: 120 })
  name!: string;

  @Property({ length: 3 })
  direction!: string;

  @Property({ fieldName: 'is_active' })
  isActive: boolean = true;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
