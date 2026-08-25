import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * Someone who may approve content (8 item 2).
 *
 * No `user_id` column, on purpose: "Aprovador não precisa ter conta de usuário". The link to an
 * account user, when there is one, is the e-mail — which is how the approver-is-not-the-author check
 * is made.
 */
@Entity({ tableName: 'approvers' })
@Index({ properties: ['accountId', 'active'] })
export class ApproverOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 200 })
  name!: string;

  /** Nullable: an approver may be reachable by WhatsApp only. At least one of the two is required. */
  @Property({ length: 255, nullable: true })
  email: string | null = null;

  @Property({ length: 20, nullable: true, fieldName: 'phone_e164' })
  phoneE164: string | null = null;

  /** Deactivated rather than deleted: past approval_requests point here. */
  @Property()
  active: boolean = true;
}
