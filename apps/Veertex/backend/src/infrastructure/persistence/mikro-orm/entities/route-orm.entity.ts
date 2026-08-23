import { Entity, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** `routes` (§2 do 04) — cadastro de rota/região. Tenant, RLS na migration. */
@Entity({ tableName: 'routes' })
export class RouteOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 120 })
  name!: string;

  @Property({ length: 40, nullable: true })
  code: string | null = null;

  @Property()
  active = true;
}
