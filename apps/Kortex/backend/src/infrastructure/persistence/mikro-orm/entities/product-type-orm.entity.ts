import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'product_type' })
@Index({ name: 'product_type_account_id_index', properties: ['accountId'] })
@Unique({ name: 'product_type_account_id_name_unique', properties: ['accountId', 'name'] })
export class ProductTypeOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ length: 120 })
  name!: string;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
