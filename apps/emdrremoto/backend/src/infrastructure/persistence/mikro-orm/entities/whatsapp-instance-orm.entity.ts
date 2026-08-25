import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

/** Config de WhatsApp por psicólogo (1:1). PK = psicologo_id. */
@Entity({ tableName: 'whatsapp_instances' })
export class WhatsappInstanceOrmEntity {
  @PrimaryKey({ fieldName: 'psicologo_id', columnType: 'varchar(36)' })
  psicologoId!: string;

  @Property({ length: 20 })
  mode!: string; // 'shared' | 'own'

  @Property({ fieldName: 'instance_name', length: 128 })
  instanceName!: string;

  @Property({ fieldName: 'api_key', length: 255 })
  apiKey!: string;

  @Property()
  connected: boolean = false;

  @Property({ fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
