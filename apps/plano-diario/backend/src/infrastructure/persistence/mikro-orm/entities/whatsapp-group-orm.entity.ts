import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { UserOrmEntity } from './user-orm.entity';
import { WhatsappInstanceOrmEntity } from './whatsapp-instance-orm.entity';

/**
 * Cache dos grupos do WhatsApp de cada usuário.
 * `unique(user_id, group_jid)` — o mesmo grupo não pode duplicar para o mesmo usuário, mas dois
 * usuários diferentes podem ter o mesmo grupo em comum.
 */
@Entity({ tableName: 'whatsapp_groups' })
@Unique({ properties: ['userId', 'groupJid'] })
export class WhatsappGroupOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  // FKs sob gestão do ORM (ver comentário em whatsapp-instance-orm.entity.ts).
  @ManyToOne(() => UserOrmEntity, {
    fieldName: 'user_id',
    mapToPk: true,
    updateRule: 'cascade',
    deleteRule: 'cascade',
  })
  @Index()
  userId!: string;

  @ManyToOne(() => WhatsappInstanceOrmEntity, {
    fieldName: 'instance_id',
    mapToPk: true,
    updateRule: 'cascade',
    deleteRule: 'cascade',
  })
  instanceId!: string;

  @Property({ fieldName: 'group_jid', length: 120 })
  groupJid!: string;

  @Property({ length: 255 })
  name!: string;

  // Tipo explícito: o MikroORM infere `varchar` para a união `number | null`.
  @Property({ fieldName: 'participants_count', type: 'int', nullable: true })
  participantsCount?: number | null;

  @Property({ fieldName: 'synced_at', type: 'timestamptz' })
  syncedAt: Date = new Date();

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ fieldName: 'updated_at', type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
