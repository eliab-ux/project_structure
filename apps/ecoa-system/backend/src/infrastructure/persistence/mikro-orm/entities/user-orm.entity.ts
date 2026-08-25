import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'app_user' })
export class UserOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ length: 255 })
  @Unique()
  email!: string;

  @Property({ length: 100 })
  name!: string;

  @Property({ fieldName: 'password_hash', length: 255 })
  passwordHash!: string;

  @Property({ length: 20 })
  role: string = 'user';

  @Property()
  active: boolean = true;

  @Property({ fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ fieldName: 'reset_token', length: 128, nullable: true })
  @Index()
  resetToken?: string | null;

  @Property({ fieldName: 'reset_token_expires_at', nullable: true })
  resetTokenExpiresAt?: Date | null;
}
