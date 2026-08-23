import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * `commercial_rules` (§3.7 do 04) — perfil do representante. As dimensões permitidas são listas de
 * ids/códigos em JSON (checkboxes); lista vazia = sem restrição. Uma por `user_id`. Tenant, RLS.
 */
@Entity({ tableName: 'commercial_rules' })
export class CommercialRuleOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'user_id' })
  userId!: string;

  @Property({ type: 'json', fieldName: 'allowed_company_ids' })
  allowedCompanyIds: string[] = [];

  @Property({ type: 'json', fieldName: 'allowed_payment_condition_ids' })
  allowedPaymentConditionIds: string[] = [];

  @Property({ type: 'json', fieldName: 'allowed_price_list_ids' })
  allowedPriceListIds: string[] = [];

  @Property({ type: 'json', fieldName: 'allowed_operation_natures' })
  allowedOperationNatures: string[] = [];
}
