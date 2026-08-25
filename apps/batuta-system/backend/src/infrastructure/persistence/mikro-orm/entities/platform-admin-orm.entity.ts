import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';

/**
 * Separate table, no `account_id`, own auth flow (BATUTA_SPEC §4). Not tenant-scoped by design:
 * there is no tenant to scope it to, so no filter can be "forgotten" here.
 */
@Entity({ tableName: 'platform_admins' })
export class PlatformAdminOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ length: 200 })
  name!: string;

  @Unique()
  @Property({ length: 255 })
  email!: string;

  /** bcrypt hash. NEVER selected into a response DTO. */
  @Property({ length: 100, fieldName: 'password_hash' })
  passwordHash!: string;

  @Property()
  active: boolean = true;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'last_login_at' })
  lastLoginAt: Date | null = null;

  @Property({ fieldName: 'created_at' })
  createdAt: Date = new Date();
}
