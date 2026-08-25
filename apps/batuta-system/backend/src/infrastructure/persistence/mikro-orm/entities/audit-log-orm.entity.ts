import { Entity, Enum, Index, PrimaryKey, Property } from '@mikro-orm/core';
import {
  AuditAction,
  AuditActorType,
} from '../../../../contexts/audit/domain/value-objects/audit-action.vo';

/**
 * Append-only trail (BATUTA_SPEC §1.6). The repository exposes no update and no delete, and the
 * entity has no setters.
 *
 * Deliberately NOT extending TenantScopedOrmEntity: `account_id` is nullable here, because
 * platform-level actions (a platform admin logging in) belong to no tenant. The trade-off is
 * that isolation is not mechanical for this one table — so every tenant-facing read goes through
 * `findForAccount()`, which filters explicitly, and the unscoped read is reachable only under
 * PlatformAdminGuard. There is a cross-tenant test pinning exactly this.
 */
@Entity({ tableName: 'audit_logs' })
@Index({ properties: ['accountId', 'createdAt'] })
@Index({ properties: ['accountId', 'action'] })
export class AuditLogOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'account_id' })
  accountId: string | null = null;

  @Enum({ items: () => AuditActorType, fieldName: 'actor_type' })
  actorType!: AuditActorType;

  @Property({ type: 'uuid', nullable: true, fieldName: 'actor_id' })
  actorId: string | null = null;

  @Enum({ items: () => AuditAction })
  action!: AuditAction;

  @Property({ length: 100, nullable: true, fieldName: 'entity_type' })
  entityType: string | null = null;

  @Property({ type: 'uuid', nullable: true, fieldName: 'entity_id' })
  entityId: string | null = null;

  /** Sanitized at construction by the domain entity — never holds a secret or personal data. */
  @Property({ type: 'json' })
  payload: Record<string, unknown> = {};

  @Property({ length: 64, nullable: true })
  ip: string | null = null;

  @Property({ fieldName: 'created_at' })
  createdAt: Date = new Date();
}
