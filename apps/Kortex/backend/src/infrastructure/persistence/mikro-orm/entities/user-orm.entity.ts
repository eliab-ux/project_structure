import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';

/**
 * A tabela chama `app_user` e não `user` (spec §4.3): `user` é palavra reservada do Postgres e
 * `select * from user` não dá erro — devolve o usuário da CONEXÃO. A classe de domínio continua
 * `User`; o prefixo existe só para o banco.
 */
@Entity({ tableName: 'app_user' })
@Index({ name: 'app_user_account_id_index', properties: ['accountId'] })
export class UserOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ length: 200 })
  name!: string;

  /** Único no sistema inteiro, não por conta: é o login, e o login não informa a conta. */
  @Property({ length: 255 })
  @Unique({ name: 'app_user_email_unique' })
  email!: string;

  @Property({ length: 20 })
  phone!: string;

  @Property({ fieldName: 'password_hash', length: 100 })
  passwordHash!: string;

  @Property({ length: 20 })
  role!: string;

  @Property({ fieldName: 'is_active' })
  isActive: boolean = true;

  @Property({ fieldName: 'must_change_password' })
  mustChangePassword: boolean = true;

  @Property({ fieldName: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null = null;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
