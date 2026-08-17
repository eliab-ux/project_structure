import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

/**
 * O aviso de vaga. Sem `machine_id`, sem horário e sem `customer_id` de propósito: isso seria
 * agendamento, e agendamento é do Administrativo, na Fase 4 (regra 6.3).
 */
@Entity({ tableName: 'slot_notice' })
export class SlotNoticeOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ fieldName: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @Property({ type: 'text' })
  note!: string;

  @Property({ length: 10 })
  status: string = 'open';

  @Property({ fieldName: 'handled_by_user_id', type: 'uuid', nullable: true })
  handledByUserId: string | null = null;

  @Property({ fieldName: 'handled_at', type: 'timestamptz', nullable: true })
  handledAt: Date | null = null;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
