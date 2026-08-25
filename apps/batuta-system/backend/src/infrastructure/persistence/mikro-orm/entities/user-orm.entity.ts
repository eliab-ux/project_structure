import { Entity, Enum, Index, Property, Unique } from '@mikro-orm/core';
import { UserRole } from '../../../../contexts/user/domain/value-objects/user-role.vo';
import { UserStatus } from '../../../../contexts/user/domain/value-objects/user-status.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

@Entity({ tableName: 'users' })
@Unique({ properties: ['accountId', 'email'] })
export class UserOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 200 })
  name!: string;

  /** Normalized to lowercase by the Email value object, so the unique index is case-insensitive. */
  @Index()
  @Property({ length: 255 })
  email!: string;

  /**
   * WhatsApp in E.164 with the leading `+` — where the password-recovery code is sent.
   *
   * Nullable ONLY for rows created before this column existed (CLAUDE.md regra 9 documents this as
   * the single allowed exception). Every user created through the API has one.
   */
  @Property({ length: 20, nullable: true })
  phone: string | null = null;

  /** bcrypt hash. NEVER selected into a response DTO. */
  @Property({ length: 100, fieldName: 'password_hash' })
  passwordHash!: string;

  @Enum({ items: () => UserRole })
  role!: UserRole;

  @Enum({ items: () => UserStatus })
  status!: UserStatus;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'last_login_at' })
  lastLoginAt: Date | null = null;
}
