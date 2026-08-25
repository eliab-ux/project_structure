import { Account } from '../../domain/entities/account.entity';
import { AccountPlan } from '../../domain/value-objects/account-plan.vo';
import { AccountStatus } from '../../domain/value-objects/account-status.vo';

/**
 * Application view of a tenant. Note what is absent on purpose: `evolutionApiKey` (secret) and
 * the full document — only the masked form crosses this boundary.
 */
export class AccountDto {
  id!: string;
  name!: string;
  documentMasked!: string;
  plan!: AccountPlan;
  status!: AccountStatus;
  dailySendCeiling!: number;
  timezone!: string;
  /** Whether the tenant runs on a dedicated Evolution server — never the URL's credentials. */
  hasDedicatedEvolutionServer!: boolean;
  suspendedAt!: Date | null;
  suspensionReason!: string | null;
  createdAt!: Date;

  static fromDomain(account: Account): AccountDto {
    const dto = new AccountDto();
    dto.id = account.id.value;
    dto.name = account.name;
    dto.documentMasked = account.document.masked;
    dto.plan = account.plan;
    dto.status = account.status;
    dto.dailySendCeiling = account.dailySendCeiling;
    dto.timezone = account.timezone;
    dto.hasDedicatedEvolutionServer = account.evolutionServerUrl !== null;
    dto.suspendedAt = account.suspendedAt;
    dto.suspensionReason = account.suspensionReason;
    dto.createdAt = account.createdAt;
    // evolutionApiKey and the raw document are intentionally never mapped.
    return dto;
  }
}
