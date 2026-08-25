import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { UserOrmEntity } from './user-orm.entity';

@Entity({ tableName: 'schedules' })
export class ScheduleOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  // unique: um agendamento por usuário na v1.
  @ManyToOne(() => UserOrmEntity, {
    fieldName: 'user_id',
    mapToPk: true,
    updateRule: 'cascade',
    deleteRule: 'cascade',
  })
  @Unique()
  userId!: string;

  @Property({ fieldName: 'group_jid', length: 120 })
  groupJid!: string;

  @Property({ fieldName: 'group_name', length: 255 })
  groupName!: string;

  /** `time` sem timezone: é hora LOCAL do usuário, interpretada com o campo `timezone`. */
  @Property({ fieldName: 'send_time', type: 'time' })
  sendTime!: string;

  @Property({ length: 64 })
  timezone: string = 'America/Sao_Paulo';

  @Property({ fieldName: 'plan_start_date', type: 'date' })
  planStartDate!: string;

  @Property({ fieldName: 'day_offset', type: 'int' })
  dayOffset: number = 0;

  @Property({ fieldName: 'message_template', type: 'text' })
  messageTemplate!: string;

  @Property({ fieldName: 'is_active' })
  @Index()
  isActive: boolean = true;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ fieldName: 'updated_at', type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
