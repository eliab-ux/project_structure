import { Entity, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** `payment_conditions` (§4.2 do 02A) — condição de pagamento nomeada. Tenant, RLS na migration. */
@Entity({ tableName: 'payment_conditions' })
export class PaymentConditionOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 120 })
  name!: string;

  @Property({ length: 20 })
  kind!: string;

  @Property()
  active = true;
}
