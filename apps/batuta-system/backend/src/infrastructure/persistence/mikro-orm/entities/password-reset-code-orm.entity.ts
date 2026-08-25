import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * Six-digit codes for password recovery over WhatsApp.
 *
 * NOT in BATUTA_SPEC §4 — the spec requires the two reset endpoints without prescribing storage.
 * Modelled after `approval_requests`: only the HASH is kept, single use, with an expiry.
 *
 * Every nullable Date column declares `type: 'timestamptz'` explicitly. Without it MikroORM infers
 * `varchar` from `Date | null` and a `schema:update` silently turns a timestamp column into text.
 */
@Entity({ tableName: 'password_reset_codes' })
@Index({ properties: ['userId'] })
export class PasswordResetCodeOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'user_id' })
  userId!: string;

  /** bcrypt hash of the six digits. 60 chars today; 100 leaves room for a cost/format change. */
  @Property({ length: 100, fieldName: 'code_hash' })
  codeHash!: string;

  @Property({ type: 'timestamptz', fieldName: 'expires_at' })
  expiresAt!: Date;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'used_at' })
  usedAt: Date | null = null;

  /** `null` = the WhatsApp message never left. Does not count towards the per-hour limit. */
  @Property({ type: 'timestamptz', nullable: true, fieldName: 'sent_at' })
  sentAt: Date | null = null;

  /** Wrong guesses so far. Five and the code is dead — see RESET_CODE_MAX_ATTEMPTS. */
  @Property({ type: 'int', default: 0 })
  attempts: number = 0;
}
