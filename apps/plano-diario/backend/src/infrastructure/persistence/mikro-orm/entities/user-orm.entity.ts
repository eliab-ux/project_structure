import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'users' })
export class UserOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ length: 255 })
  @Unique()
  email!: string;

  @Property({ fieldName: 'password_hash', length: 255 })
  passwordHash!: string;

  @Property({ length: 120 })
  name!: string;

  /**
   * WhatsApp em E.164 sem `+` (`5511912345678`). Anulável no banco porque as contas criadas antes
   * deste campo não têm número — o cadastro novo exige, e quem já tem conta preenche na tela.
   */
  @Property({ length: 20, nullable: true })
  phone: string | null = null;

  @Property({ length: 20 })
  role: string = 'user';

  @Property({ fieldName: 'is_active' })
  isActive: boolean = true;

  @Property({ fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
