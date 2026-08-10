import { Entity, Enum, Index, Property, Unique } from '@mikro-orm/core';
import { AccessWindowProps } from '../../../../contexts/user/domain/value-objects/access-window.vo';
import { UserStatus } from '../../../../contexts/user/domain/value-objects/user-status.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

@Entity({ tableName: 'users' })
@Unique({ properties: ['accountId', 'email'] })
export class UserOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 200 })
  name!: string;

  /** Normalised to lowercase by the Email value object, so the unique index is case-insensitive. */
  @Index()
  @Property({ length: 255 })
  email!: string;

  /**
   * WhatsApp in E.164 with the leading `+` — where the password-recovery code is sent.
   *
   * **NOT NULL, from the first migration.** CLAUDE.md regra 9 allows a nullable phone in exactly one
   * case — a column added to a table that already has rows — and Veertex is greenfield, so that
   * exception does not apply here. A user without a number is a user who loses the account at the
   * first forgotten password.
   */
  @Property({ length: 20 })
  phone!: string;

  /** bcrypt hash. NEVER selected into a response DTO. */
  @Property({ length: 100, fieldName: 'password_hash' })
  passwordHash!: string;

  @Index()
  @Property({ type: 'uuid', fieldName: 'role_id' })
  roleId!: string;

  @Enum({ items: () => UserStatus })
  status!: UserStatus;

  /**
   * Permitted login windows (01_Veertex_Core §3.3). `null` = no restriction.
   *
   * Modelled in F1, enforced later — §3.3 puts the UI in phase 2, and enforcing a rule whose UI does
   * not exist would lock people out with no way to see what did it.
   */
  @Property({ type: 'json', nullable: true, fieldName: 'access_windows' })
  accessWindows: AccessWindowProps[] | null = null;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'last_login_at' })
  lastLoginAt: Date | null = null;
}
