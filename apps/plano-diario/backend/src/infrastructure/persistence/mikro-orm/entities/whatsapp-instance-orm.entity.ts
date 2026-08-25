import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { UserOrmEntity } from './user-orm.entity';

@Entity({ tableName: 'whatsapp_instances' })
export class WhatsappInstanceOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  /**
   * `mapToPk: true` mantém a propriedade como o id em texto (mappers e repositórios seguem
   * simples) e ao mesmo tempo deixa a FK sob gestão do ORM — sem isso, uma constraint criada
   * só no SQL seria removida pelo próximo diff de migration.
   *
   * unique: uma instância por usuário na v1. O schema suportaria várias trocando isto.
   */
  @ManyToOne(() => UserOrmEntity, {
    fieldName: 'user_id',
    mapToPk: true,
    updateRule: 'cascade',
    deleteRule: 'cascade',
  })
  @Unique()
  userId!: string;

  @Property({ fieldName: 'instance_name', length: 120 })
  @Unique()
  instanceName!: string;

  /** Criptografado (AES-256-GCM). `text` porque o ciphertext é bem maior que o token. */
  @Property({ fieldName: 'instance_token', type: 'text' })
  instanceToken!: string;

  @Property({ length: 30 })
  @Index()
  status!: string;

  @Property({ fieldName: 'connected_number', length: 30, nullable: true })
  connectedNumber?: string | null;

  @Property({ fieldName: 'last_status_at', type: 'timestamptz' })
  lastStatusAt: Date = new Date();

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ fieldName: 'updated_at', type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
