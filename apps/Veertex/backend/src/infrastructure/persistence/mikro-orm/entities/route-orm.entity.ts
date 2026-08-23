import { Entity, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** `routes` (§2 do 04) — cadastro de rota/região. Tenant, RLS na migration. */
@Entity({ tableName: 'routes' })
export class RouteOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 120 })
  name!: string;

  @Property({ length: 40, nullable: true })
  code: string | null = null;

  /** Ciclo da rota em dias (~60) — vencimento do título consignado (§3.4 do 04). */
  @Property({ type: 'int', fieldName: 'cycle_days' })
  cycleDays = 60;

  @Property()
  active = true;
}
