import { PhoneChangeAudit } from '../../../domain/entities/phone-change-audit.entity';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';

export const PHONE_CHANGE_AUDIT_REPOSITORY = Symbol('PHONE_CHANGE_AUDIT_REPOSITORY');

export interface PhoneChangeAuditRepositoryPort {
  save(audit: PhoneChangeAudit): Promise<PhoneChangeAudit>;
  /** Trilha de um usuário, mais recente primeiro. Só `admin`/`owner` chegam a ela. */
  listByUser(accountId: AccountId, userId: UserId): Promise<PhoneChangeAudit[]>;
}
