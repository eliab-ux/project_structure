import { Entity, Enum, Index, PrimaryKey, Property } from '@mikro-orm/core';
import { AccountPlan } from '../../../../contexts/account/domain/value-objects/account-plan.vo';
import { AccountStatus } from '../../../../contexts/account/domain/value-objects/account-status.vo';

/**
 * `accounts` IS the tenant, so it does not extend TenantScopedOrmEntity and carries no
 * `account_id` — its own `id` is the tenant (BATUTA_SPEC §4). Consequently it is NOT covered by
 * the global tenant filter: every read of an account must go through a use case that either
 * (a) uses the `accountId` from the JWT, or (b) runs under the platform scope.
 */
@Entity({ tableName: 'accounts' })
export class AccountOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ length: 200 })
  name!: string;

  /** CPF/CNPJ digits only. */
  @Index()
  @Property({ length: 14 })
  document!: string;

  @Enum({ items: () => AccountPlan, nativeEnumName: undefined })
  plan!: AccountPlan;

  @Index()
  @Enum({ items: () => AccountStatus })
  status!: AccountStatus;

  /** Hard account-wide ceiling. Prevails over the sum of channel quotas (§9.2). */
  @Property({ type: 'int', fieldName: 'daily_send_ceiling' })
  dailySendCeiling!: number;

  @Property({ length: 64 })
  timezone!: string;

  /** Null → shared platform Evolution server; set → dedicated server for this tenant (§14.7). */
  @Property({ length: 300, nullable: true, fieldName: 'evolution_server_url' })
  evolutionServerUrl: string | null = null;

  /** Secret at rest. Never mapped into any ResponseDto. */
  @Property({ length: 300, nullable: true, fieldName: 'evolution_api_key' })
  evolutionApiKey: string | null = null;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'suspended_at' })
  suspendedAt: Date | null = null;

  @Property({ length: 500, nullable: true, fieldName: 'suspension_reason' })
  suspensionReason: string | null = null;

  @Property({ fieldName: 'created_at' })
  createdAt: Date = new Date();
}
