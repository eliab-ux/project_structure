import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core';

@Entity({ tableName: 'psicologos' })
export class PsicologoOrmEntity {
  @PrimaryKey({ columnType: 'varchar(36)' })
  id!: string;

  @Property({ length: 255 })
  @Unique()
  email!: string;

  @Property({ length: 150 })
  nome!: string;

  @Property({ length: 30 })
  telefone!: string;

  @Property({ fieldName: 'password_hash', length: 255 })
  passwordHash!: string;

  @Property({ fieldName: 'email_verificado' })
  emailVerificado: boolean = false;

  @Property({ fieldName: 'recovery_code', length: 128, nullable: true })
  @Index()
  recoveryCode?: string | null;

  @Property()
  active: boolean = true;

  @Property({ fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
