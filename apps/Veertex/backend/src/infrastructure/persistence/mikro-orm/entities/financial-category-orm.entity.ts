import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** `financial_categories` (§2.4 do 05) — árvore, dre_line, default por operação. Tenant, RLS. */
@Entity({ tableName: 'financial_categories' })
export class FinancialCategoryOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 120 })
  name!: string;

  @Property({ length: 10 })
  kind!: string;

  @Index()
  @Property({ type: 'uuid', nullable: true, fieldName: 'parent_id' })
  parentId: string | null = null;

  @Property({ length: 60, nullable: true, fieldName: 'dre_line' })
  dreLine: string | null = null;

  @Index()
  @Property({ length: 20, nullable: true, fieldName: 'default_operation' })
  defaultOperation: string | null = null;

  @Property()
  active = true;
}
