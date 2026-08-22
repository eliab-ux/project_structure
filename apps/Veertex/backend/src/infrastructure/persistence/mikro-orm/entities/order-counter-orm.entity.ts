import { Entity, Property, Unique } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * `order_counters` — o próximo número de pedido POR empresa (§2.6). Não é um campo no pedido: é
 * design próprio, com lock, porque numeração sequencial sob concorrência exige serialização.
 *
 * Tabela de TENANT (RLS na migration). Uma linha por `(account_id, company_id)`. A alocação usa
 * `SELECT ... FOR UPDATE` (lock pessimista) dentro da transação do `CreateOrder`.
 */
@Entity({ tableName: 'order_counters' })
@Unique({ properties: ['accountId', 'companyId'] })
export class OrderCounterOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'company_id' })
  companyId!: string;

  @Property({ type: 'int', fieldName: 'next_number' })
  nextNumber = 1;
}
