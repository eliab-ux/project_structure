import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core';

@Entity({ tableName: 'pacientes' })
export class PacienteOrmEntity {
  @PrimaryKey({ columnType: 'varchar(36)' })
  id!: string;

  @Property({ length: 255 })
  email!: string;

  @Property({ length: 150 })
  nome!: string;

  @Property({ length: 30 })
  telefone!: string;

  @Property({ length: 80, nullable: true })
  pais?: string | null;

  // Invite/access token for the patient — treated as a credential (unique, indexed).
  @Property({ length: 64 })
  @Unique()
  hash!: string;

  @Property({ fieldName: 'psicologo_id', columnType: 'varchar(36)' })
  @Index()
  psicologoId!: string;

  @Property()
  active: boolean = true;

  @Property({ fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
