import { Entity, Enum, Index, Property } from '@mikro-orm/core';
import { ApprovalRequestStatus } from '../../../../contexts/approval/domain/value-objects/approval-status.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * One approver pending decision on one exact version of a content (8 item 4).
 *
 * `content_hash` is stored HERE, next to the decision, and that is the point: the row does not say
 * "Ana approved this content", it says "Ana approved THIS VERSION, at this time, from this IP". That is
 * what makes the trail defensible rather than decorative.
 */
@Entity({ tableName: 'approval_requests' })
@Index({ properties: ['contentId', 'status'] })
@Index({ properties: ['accountId', 'status'] })
export class ApprovalRequestOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'content_id' })
  contentId!: string;

  /** The version being decided upon. A mismatch with the content means the request is stale. */
  @Property({ length: 64, fieldName: 'content_hash' })
  contentHash!: string;

  @Property({ type: 'uuid', fieldName: 'approver_id' })
  approverId!: string;

  /** sha256 of the magic-link token. The plaintext exists only in the message that went out. */
  @Property({ length: 64, unique: true, fieldName: 'token_hash' })
  tokenHash!: string;

  @Property({ fieldName: 'expires_at' })
  expiresAt!: Date;

  @Enum({ items: () => ApprovalRequestStatus })
  status!: ApprovalRequestStatus;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'decided_at' })
  decidedAt: Date | null = null;

  /** Recorded so the decision can be defended later: who, when, from where, on what. */
  @Property({ length: 64, nullable: true, fieldName: 'decided_ip' })
  decidedIp: string | null = null;

  @Property({ length: 300, nullable: true, fieldName: 'decided_user_agent' })
  decidedUserAgent: string | null = null;

  /** Visible to the author, especially on a rejection (8.5). */
  @Property({ type: 'text', nullable: true })
  comment: string | null = null;
}
