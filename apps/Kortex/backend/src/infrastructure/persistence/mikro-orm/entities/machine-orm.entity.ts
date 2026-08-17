import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'machine' })
@Index({ name: 'machine_account_id_index', properties: ['accountId'] })
export class MachineOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ length: 200 })
  name!: string;

  @Property({ length: 200, nullable: true })
  model: string | null = null;

  @Property({ fieldName: 'hour_price_cents', type: 'int' })
  hourPriceCents!: number;

  @Property({ fieldName: 'is_active' })
  isActive: boolean = true;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
