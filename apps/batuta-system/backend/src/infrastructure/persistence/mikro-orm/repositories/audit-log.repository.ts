import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { AuditLogRepositoryPort } from '../../../../contexts/audit/application/ports/output/audit-log-repository.port';
import { AuditLog } from '../../../../contexts/audit/domain/entities/audit-log.entity';
import { AuditLogOrmEntity } from '../entities/audit-log-orm.entity';

/**
 * Append-only (BATUTA_SPEC §1.6): this class exposes `append` and nothing else. No update, no
 * delete, no read-then-write. A test asserts exactly this surface, so adding one later fails the
 * build instead of slipping through review.
 *
 * `em.insert` is a plain INSERT with no identity-map bookkeeping, so a later flush of the same
 * request cannot turn it into an UPDATE.
 */
@Injectable()
export class MikroOrmAuditLogRepository implements AuditLogRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async append(log: AuditLog): Promise<void> {
    await this.em.insert(AuditLogOrmEntity, {
      id: log.id,
      accountId: log.accountId,
      actorType: log.actorType,
      actorId: log.actorId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      payload: log.payload,
      ip: log.ip,
      createdAt: log.createdAt,
    });
  }
}
