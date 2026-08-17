import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'account' })
export class AccountOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ length: 200 })
  name!: string;

  @Property({ length: 120 })
  city!: string;

  @Property({ fieldName: 'report_owner_name', length: 200, nullable: true })
  reportOwnerName: string | null = null;

  @Property({ fieldName: 'report_owner_role', length: 120, nullable: true })
  reportOwnerRole: string | null = null;

  @Property({ fieldName: 'report_owner_phone', length: 20, nullable: true })
  reportOwnerPhone: string | null = null;

  @Property({ fieldName: 'report_owner_email', length: 255, nullable: true })
  reportOwnerEmail: string | null = null;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
