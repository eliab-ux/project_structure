import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * A password-recovery code. Only the bcrypt HASH is stored — neither a database dump nor a log line
 * reveals the six digits.
 */
@Entity({ tableName: 'password_reset_codes' })
export class PasswordResetCodeOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'user_id' })
  userId!: string;

  @Property({ length: 100, fieldName: 'code_hash' })
  codeHash!: string;

  @Property({ type: 'timestamptz', fieldName: 'expires_at' })
  expiresAt!: Date;

  /** Counted BEFORE each comparison, so the five-attempt limit is enforceable. */
  @Property({ type: 'smallint' })
  attempts: number = 0;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'consumed_at' })
  consumedAt: Date | null = null;

  /**
   * Set only after the WhatsApp send actually succeeded. The hourly quota counts SENDS, so a
   * gateway outage cannot consume a user's ability to recover their account.
   */
  @Property({ type: 'timestamptz', nullable: true, fieldName: 'sent_at' })
  sentAt: Date | null = null;
}
