import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'schedule_entry' })
@Index({ name: 'schedule_entry_account_id_starts_at_index', properties: ['accountId', 'startsAt'] })
export class ScheduleEntryOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  /** Obrigatória em `machine_hour`, nula em `consultation` — o CHECK no banco cobra o par. */
  @Property({ fieldName: 'machine_id', type: 'uuid', nullable: true })
  machineId: string | null = null;

  @Property({ length: 15 })
  type!: string;

  @Property({ fieldName: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Property({ fieldName: 'ends_at', type: 'timestamptz' })
  endsAt!: Date;

  @Property({ fieldName: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null = null;

  @Property({ length: 200, nullable: true })
  title: string | null = null;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
