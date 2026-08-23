import { Entity, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** `financial_accounts` (§2.3 do 05) — caixa/banco/integração. Tenant, RLS na migration. */
@Entity({ tableName: 'financial_accounts' })
export class FinancialAccountOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 120 })
  name!: string;

  @Property({ length: 20 })
  type!: string;

  @Property({ length: 120, nullable: true })
  institution: string | null = null;

  @Property({ type: 'numeric', precision: 14, scale: 2, fieldName: 'initial_balance' })
  initialBalance = '0';

  @Property()
  automatic = false;

  @Property()
  active = true;
}
