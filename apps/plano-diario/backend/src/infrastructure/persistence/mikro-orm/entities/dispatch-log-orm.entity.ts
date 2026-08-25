import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { ScheduleOrmEntity } from './schedule-orm.entity';
import { UserOrmEntity } from './user-orm.entity';

/**
 * A UNIQUE parcial `(schedule_id, reference_date) WHERE trigger = 'scheduled'` é criada à mão na
 * migration: o MikroORM não expressa índice parcial via decorator. É ela que garante 1 envio
 * agendado por dia — e por isso o envio manual, que fica fora dela, nunca é bloqueado.
 */
@Entity({ tableName: 'dispatch_logs' })
export class DispatchLogOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => UserOrmEntity, {
    fieldName: 'user_id',
    mapToPk: true,
    updateRule: 'cascade',
    deleteRule: 'cascade',
  })
  @Index()
  userId!: string;

  @ManyToOne(() => ScheduleOrmEntity, {
    fieldName: 'schedule_id',
    mapToPk: true,
    updateRule: 'cascade',
    deleteRule: 'cascade',
  })
  scheduleId!: string;

  /** Data LOCAL do usuário — é a chave da idempotência, junto com schedule_id. */
  @Property({ fieldName: 'reference_date', type: 'date' })
  referenceDate!: string;

  @Property({ fieldName: 'day_number', type: 'int', nullable: true })
  dayNumber?: number | null;

  @Property({ fieldName: 'video_id', length: 32, nullable: true })
  videoId?: string | null;

  @Property({ fieldName: 'message_sent', type: 'text', nullable: true })
  messageSent?: string | null;

  @Property({ length: 20 })
  @Index()
  status!: string;

  /** Já sanitizado pela entidade de domínio — sem token, sem apikey. */
  @Property({ fieldName: 'error_reason', type: 'text', nullable: true })
  errorReason?: string | null;

  @Property({ type: 'int' })
  attempts: number = 0;

  @Property({ fieldName: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @Property({ length: 20 })
  trigger!: string;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  @Index()
  createdAt: Date = new Date();

  @Property({ fieldName: 'updated_at', type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
