import { AuditLog } from '../../../domain/entities/audit-log.entity';

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');

/**
 * Append-only by contract: there is no update and no delete here, and there never will be
 * (BATUTA_SPEC §1.6). Adding one is a spec violation, not a feature.
 */
export interface AuditLogRepositoryPort {
  append(log: AuditLog): Promise<void>;
}
